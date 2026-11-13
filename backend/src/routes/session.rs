//! 進行中のタスク: 始める → 1つずつ完了にする → 一言メモを付けて記録する
//!
//! 状態は暗号化 Cookie に入っている（crate::session を参照）。記録するまで DB には書かない。

use std::collections::HashSet;

use axum::Json;
use axum::extract::State;
use axum::http::StatusCode;
use axum_extra::extract::cookie::PrivateCookieJar;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

use super::{ApiJson, ApiPath};
use crate::AppState;
use crate::db;
use crate::domain::{
    MAX_SESSION_TASKS, MEMO_MAX_LENGTH, completion_rate, condition_label, normalize_memo,
    parse_condition,
};
use crate::error::{ApiError, ApiResult};
use crate::session::{self, ActiveSession, SessionTask};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionView {
    condition: i64,
    condition_label: &'static str,
    tasks: Vec<SessionTask>,
    /// 進捗率（0〜100）
    rate: f64,
    is_complete: bool,
    memo_max_length: usize,
}

impl From<&ActiveSession> for SessionView {
    fn from(s: &ActiveSession) -> Self {
        Self {
            condition: s.condition,
            condition_label: condition_label(s.condition),
            tasks: s.tasks.clone(),
            rate: completion_rate(s.tasks.iter().map(|t| t.done)),
            is_complete: s.is_complete(),
            memo_max_length: MEMO_MAX_LENGTH,
        }
    }
}

fn no_session() -> ApiError {
    ApiError::Conflict("進行中のタスクがありません。調子を選ぶところから始めてください".into())
}

#[derive(Serialize)]
pub struct CurrentResponse {
    session: Option<SessionView>,
}

/// GET /api/session — 進行中のタスク（無ければ session: null）
pub async fn current(jar: PrivateCookieJar) -> Json<CurrentResponse> {
    Json(CurrentResponse {
        session: session::load(&jar).as_ref().map(SessionView::from),
    })
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartRequest {
    condition: i64,
    template_ids: Vec<i64>,
}

/// POST /api/session — {"condition": 0〜2, "templateIds": [...]}
/// 選ばれた id のうち、その調子のテンプレートに実在するものだけを使う（並びはテンプレート順）
pub async fn start(
    State(state): State<AppState>,
    jar: PrivateCookieJar,
    ApiJson(body): ApiJson<StartRequest>,
) -> ApiResult<(StatusCode, PrivateCookieJar, Json<SessionView>)> {
    let condition = parse_condition(body.condition)
        .ok_or_else(|| ApiError::BadRequest("調子は 0〜2 で指定してください".into()))?;
    let selected: HashSet<i64> = body.template_ids.into_iter().collect();
    let tasks: Vec<SessionTask> = db::list_templates(&state.db())?
        .into_iter()
        .filter(|r| r.condition == condition && selected.contains(&r.id))
        .map(|r| SessionTask {
            name: r.name,
            done: false,
        })
        .collect();
    if tasks.is_empty() {
        return Err(ApiError::BadRequest(
            "タスクを1つ以上選択してください".into(),
        ));
    }
    if tasks.len() > MAX_SESSION_TASKS {
        return Err(ApiError::BadRequest(format!(
            "一度に選べるタスクは{MAX_SESSION_TASKS}件までです"
        )));
    }
    let active = ActiveSession { condition, tasks };
    let view = SessionView::from(&active);
    Ok((
        StatusCode::CREATED,
        session::store(jar, &active),
        Json(view),
    ))
}

/// POST /api/session/tasks/{index}/complete — index 番目（0 始まり）のタスクを完了にする。
/// 同じ名前のタスクがあっても1つだけ完了になるよう、名前ではなく位置で指定する
pub async fn complete(
    jar: PrivateCookieJar,
    ApiPath(index): ApiPath<usize>,
) -> ApiResult<(PrivateCookieJar, Json<SessionView>)> {
    let mut active = session::load(&jar).ok_or_else(no_session)?;
    let task = active
        .tasks
        .get_mut(index)
        .ok_or_else(|| ApiError::BadRequest("タスクの番号が正しくありません".into()))?;
    task.done = true;
    let view = SessionView::from(&active);
    Ok((session::store(jar, &active), Json(view)))
}

#[derive(Deserialize)]
pub struct SaveRequest {
    #[serde(default)]
    memo: String,
}

/// POST /api/session/save — {"memo": "..."}。記録を DB に保存し、進行中の状態を消す
pub async fn save(
    State(state): State<AppState>,
    jar: PrivateCookieJar,
    ApiJson(body): ApiJson<SaveRequest>,
) -> ApiResult<(StatusCode, PrivateCookieJar, Json<Value>)> {
    let active = session::load(&jar).ok_or_else(no_session)?;
    let memo = normalize_memo(&body.memo);
    let created_at = db::save_logs(&mut state.db(), &active, &memo)?;
    Ok((
        StatusCode::CREATED,
        session::clear(jar),
        Json(json!({ "createdAt": created_at })),
    ))
}
