//! API の結合テスト。メモリ上の SQLite を使い、HTTP サーバーは立てずにルーターを直接呼ぶ。

use axum::Router;
use axum::body::Body;
use axum::http::{Request, StatusCode, header};
use http_body_util::BodyExt;
use serde_json::{Value, json};
use tower::ServiceExt;

use tascon::{AppState, db, router, session};

/// Cookie を覚えて次のリクエストに付けるだけの簡単なクライアント
struct Client {
    app: Router,
    cookie: Option<String>,
}

impl Client {
    fn new() -> Self {
        let conn = db::open(":memory:").unwrap();
        let state = AppState::new(conn, session::key_from_secret("test-secret"));
        Self {
            app: router(state, None),
            cookie: None,
        }
    }

    async fn send(&mut self, method: &str, path: &str, body: Option<Value>) -> (StatusCode, Value) {
        let mut req = Request::builder().method(method).uri(path);
        if let Some(cookie) = &self.cookie {
            req = req.header(header::COOKIE, cookie);
        }
        let req = match body {
            Some(b) => req
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(b.to_string())),
            None => req.body(Body::empty()),
        }
        .unwrap();
        let res = self.app.clone().oneshot(req).await.unwrap();
        if let Some(set) = res.headers().get(header::SET_COOKIE) {
            // name=value; Path=/ ... の name=value 部分だけを覚える（削除時は空になる）
            let pair = set.to_str().unwrap().split(';').next().unwrap().to_string();
            self.cookie = if pair.ends_with('=') {
                None
            } else {
                Some(pair)
            };
        }
        let status = res.status();
        let bytes = res.into_body().collect().await.unwrap().to_bytes();
        let value = if bytes.is_empty() {
            Value::Null
        } else {
            serde_json::from_slice(&bytes).unwrap()
        };
        (status, value)
    }

    async fn get(&mut self, path: &str) -> (StatusCode, Value) {
        self.send("GET", path, None).await
    }

    async fn post(&mut self, path: &str, body: Value) -> (StatusCode, Value) {
        self.send("POST", path, Some(body)).await
    }

    /// 指定した調子のテンプレート id 一覧
    async fn template_ids(&mut self, condition: i64) -> Vec<i64> {
        let (_, body) = self.get("/api/templates").await;
        body["groups"]
            .as_array()
            .unwrap()
            .iter()
            .find(|g| g["condition"] == condition)
            .unwrap()["tasks"]
            .as_array()
            .unwrap()
            .iter()
            .map(|t| t["id"].as_i64().unwrap())
            .collect()
    }
}

#[tokio::test]
async fn templates_are_seeded_and_validated() {
    let mut c = Client::new();
    let (_, body) = c.get("/api/templates").await;
    assert_eq!(body["nameMaxLength"], 50);
    let order: Vec<_> = body["groups"]
        .as_array()
        .unwrap()
        .iter()
        .map(|g| (g["condition"].clone(), g["label"].clone()))
        .collect();
    assert_eq!(
        order,
        vec![
            (json!(2), json!("良い")),
            (json!(1), json!("普通")),
            (json!(0), json!("よくない"))
        ],
        "良い → よくない の順"
    );
    let count = |b: &Value| {
        b["groups"]
            .as_array()
            .unwrap()
            .iter()
            .map(|g| g["tasks"].as_array().unwrap().len())
            .sum::<usize>()
    };
    assert_eq!(count(&body), 12);

    for bad in [
        json!({"condition": 1, "name": "   "}),
        json!({"condition": 9, "name": "不正な調子"}),
        json!({"condition": 1, "name": "あ".repeat(51)}),
        json!({"condition": "1", "name": "型が違う"}),
    ] {
        let (status, body) = c.post("/api/templates", bad).await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
        assert!(body["error"].is_string());
    }
    let (_, body) = c.get("/api/templates").await;
    assert_eq!(count(&body), 12, "不正な入力では追加されない");

    let (status, created) = c
        .post(
            "/api/templates",
            json!({"condition": 1, "name": "  音読5分 "}),
        )
        .await;
    assert_eq!(status, StatusCode::CREATED);
    assert_eq!(created["name"], "音読5分");
    let id = created["id"].as_i64().unwrap();

    let (status, _) = c
        .send(
            "PATCH",
            &format!("/api/templates/{id}"),
            Some(json!({"name": " "})),
        )
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let (status, renamed) = c
        .send(
            "PATCH",
            &format!("/api/templates/{id}"),
            Some(json!({"name": "音読10分"})),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(renamed["name"], "音読10分");

    assert_eq!(
        c.send("DELETE", &format!("/api/templates/{id}"), None)
            .await
            .0,
        StatusCode::NO_CONTENT
    );
    assert_eq!(
        c.send("DELETE", &format!("/api/templates/{id}"), None)
            .await
            .0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        c.send("DELETE", "/api/templates/abc", None).await.0,
        StatusCode::BAD_REQUEST
    );
}

#[tokio::test]
async fn session_requires_valid_selection() {
    let mut c = Client::new();
    assert_eq!(c.get("/api/session").await.1, json!({"session": null}));

    let (status, body) = c
        .post("/api/session", json!({"condition": 5, "templateIds": [1]}))
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");
    let (status, body) = c
        .post(
            "/api/session",
            json!({"condition": 0, "templateIds": [9999]}),
        )
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["error"], "タスクを1つ以上選択してください");

    // 別の調子のテンプレート id は使われない
    let good = c.template_ids(2).await;
    let (status, _) = c
        .post("/api/session", json!({"condition": 0, "templateIds": good}))
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);

    // 進行中のタスクが無いのに完了・記録しようとすると 409
    assert_eq!(
        c.post("/api/session/tasks/0/complete", json!({})).await.0,
        StatusCode::CONFLICT
    );
    assert_eq!(
        c.post("/api/session/save", json!({"memo": ""})).await.0,
        StatusCode::CONFLICT
    );
}

#[tokio::test]
async fn session_task_limit() {
    let mut c = Client::new();
    for i in 0..10 {
        c.post(
            "/api/templates",
            json!({"condition": 1, "name": format!("追加{i}")}),
        )
        .await;
    }
    let ids = c.template_ids(1).await;
    assert_eq!(ids.len(), 14);
    let (status, body) = c
        .post("/api/session", json!({"condition": 1, "templateIds": ids}))
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["error"], "一度に選べるタスクは10件までです");
}

#[tokio::test]
async fn full_flow_with_duplicate_names() {
    let mut c = Client::new();
    c.post(
        "/api/templates",
        json!({"condition": 0, "name": "同名タスク"}),
    )
    .await;
    c.post(
        "/api/templates",
        json!({"condition": 0, "name": "同名タスク"}),
    )
    .await;
    let ids = c.template_ids(0).await;
    assert_eq!(ids.len(), 6);

    // 送る順に関係なく、テンプレートの順で並ぶ
    let (status, s) = c
        .post(
            "/api/session",
            json!({"condition": 0, "templateIds": [ids[5], ids[0], ids[4]]}),
        )
        .await;
    assert_eq!(status, StatusCode::CREATED);
    assert_eq!(s["conditionLabel"], "よくない");
    assert_eq!(s["rate"], 0.0);
    let names: Vec<_> = s["tasks"]
        .as_array()
        .unwrap()
        .iter()
        .map(|t| t["name"].clone())
        .collect();
    assert_eq!(
        names,
        vec![
            json!("過去問10問"),
            json!("同名タスク"),
            json!("同名タスク")
        ]
    );

    // 同名タスクの片方だけが完了になる
    let (_, s) = c.post("/api/session/tasks/1/complete", json!({})).await;
    let done: Vec<_> = s["tasks"]
        .as_array()
        .unwrap()
        .iter()
        .map(|t| t["done"].as_bool().unwrap())
        .collect();
    assert_eq!(done, vec![false, true, false]);
    assert_eq!(s["isComplete"], false);
    assert_eq!(
        c.post("/api/session/tasks/3/complete", json!({})).await.0,
        StatusCode::BAD_REQUEST
    );

    // Cookie から復元できる
    let (_, current) = c.get("/api/session").await;
    assert_eq!(current["session"]["tasks"][1]["done"], true);

    let (status, saved) = c
        .post("/api/session/save", json!({"memo": "x".repeat(300)}))
        .await;
    assert_eq!(status, StatusCode::CREATED);
    assert!(saved["createdAt"].is_string());
    assert_eq!(
        c.get("/api/session").await.1,
        json!({"session": null}),
        "記録したら進行中の状態は消える"
    );

    // 2回目: 良い・全部完了
    let ids = c.template_ids(2).await;
    c.post(
        "/api/session",
        json!({"condition": 2, "templateIds": [ids[0], ids[1]]}),
    )
    .await;
    c.post("/api/session/tasks/0/complete", json!({})).await;
    let (_, s) = c.post("/api/session/tasks/1/complete", json!({})).await;
    assert_eq!(s["isComplete"], true);
    assert_eq!(s["rate"], 100.0);
    c.post("/api/session/save", json!({})).await;

    let (_, logs) = c.get("/api/logs").await;
    let sessions = logs["sessions"].as_array().unwrap();
    assert_eq!(sessions.len(), 2);
    assert_eq!(sessions[0]["condition"], 2, "新しい記録が先");
    let first = &sessions[1];
    assert_eq!(first["conditionLabel"], "よくない");
    assert_eq!(
        first["memo"].as_str().unwrap().chars().count(),
        200,
        "メモは200文字まで"
    );
    let names: Vec<_> = first["tasks"]
        .as_array()
        .unwrap()
        .iter()
        .map(|t| t["name"].clone())
        .collect();
    assert_eq!(
        names,
        vec![
            json!("過去問10問"),
            json!("同名タスク"),
            json!("同名タスク")
        ],
        "選んだ順のまま"
    );

    let (_, stats) = c.get("/api/stats").await;
    assert_eq!(stats["totalTasks"], 5);
    assert_eq!(stats["doneTasks"], 3);
    assert_eq!(stats["rate"], 60.0);
    let rates: Vec<_> = stats["conditionRates"]
        .as_array()
        .unwrap()
        .iter()
        .map(|r| r["rate"].clone())
        .collect();
    assert_eq!(rates[1], Value::Null, "普通は記録が無いので null");
    let counts: Vec<_> = stats["composition"]
        .as_array()
        .unwrap()
        .iter()
        .map(|r| r["count"].as_i64().unwrap())
        .collect();
    assert_eq!(counts, vec![1, 0, 1]);
    assert_eq!(stats["recentTotal"], 2);

    // 記録の削除（created_at に : や . が入るので URL エンコードして渡す）
    let created_at = sessions[0]["createdAt"]
        .as_str()
        .unwrap()
        .replace(':', "%3A");
    assert_eq!(
        c.send("DELETE", &format!("/api/logs/{created_at}"), None)
            .await
            .0,
        StatusCode::NO_CONTENT
    );
    assert_eq!(
        c.send("DELETE", &format!("/api/logs/{created_at}"), None)
            .await
            .0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        c.get("/api/logs").await.1["sessions"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
}

#[tokio::test]
async fn stats_without_logs_are_null() {
    let mut c = Client::new();
    let (_, stats) = c.get("/api/stats").await;
    assert_eq!(stats["rate"], Value::Null);
    assert_eq!(stats["recentTotal"], 0);
}

#[tokio::test]
async fn tampered_cookie_is_ignored() {
    let mut c = Client::new();
    c.cookie = Some("tascon_session=not-encrypted".into());
    assert_eq!(c.get("/api/session").await.1, json!({"session": null}));
}

#[tokio::test]
async fn errors_are_json() {
    let mut c = Client::new();
    let (status, body) = c.get("/api/unknown").await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert!(body["error"].is_string());

    // Content-Type が JSON でない POST は 400（別サイトのフォームから送られても通らない）
    let req = Request::builder()
        .method("POST")
        .uri("/api/templates")
        .header(header::CONTENT_TYPE, "application/x-www-form-urlencoded")
        .body(Body::from("condition=1&name=x"))
        .unwrap();
    let res = c.app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::BAD_REQUEST);
}
