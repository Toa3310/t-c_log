//! tascon のバックエンド。JSON API（/api/...）と、ビルド済みフロントエンドの配信を行う。

pub mod db;
pub mod domain;
pub mod error;
mod routes;
pub mod session;

use std::path::Path;
use std::sync::{Arc, Mutex, MutexGuard};

use axum::Router;
use axum::extract::FromRef;
use axum::routing::{delete, get, patch, post};
use axum_extra::extract::cookie::Key;
use rusqlite::Connection;
use tower_http::services::{ServeDir, ServeFile};

use crate::error::ApiError;

/// ハンドラーで共有する状態
#[derive(Clone)]
pub struct AppState {
    // 1人で使う小さなアプリなので、接続は1本を Mutex で共有する（SQLite の処理は短いので待ちは問題にならない）
    db: Arc<Mutex<Connection>>,
    key: Key,
}

impl AppState {
    pub fn new(conn: Connection, key: Key) -> Self {
        Self {
            db: Arc::new(Mutex::new(conn)),
            key,
        }
    }

    pub fn db(&self) -> MutexGuard<'_, Connection> {
        // 別のリクエストが処理中にパニックしても、接続自体は使い続けられる
        self.db
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

/// PrivateCookieJar（暗号化 Cookie）が鍵を取り出せるようにする
impl FromRef<AppState> for Key {
    fn from_ref(state: &AppState) -> Key {
        state.key.clone()
    }
}

/// ルーティング。static_dir を渡すと、API 以外のパスはフロントエンド（index.html）を返す
pub fn router(state: AppState, static_dir: Option<&Path>) -> Router {
    let api = Router::new()
        .route(
            "/templates",
            get(routes::templates::list).post(routes::templates::create),
        )
        .route(
            "/templates/{id}",
            patch(routes::templates::rename).delete(routes::templates::remove),
        )
        .route(
            "/session",
            get(routes::session::current).post(routes::session::start),
        )
        .route(
            "/session/tasks/{index}/complete",
            post(routes::session::complete),
        )
        .route("/session/save", post(routes::session::save))
        .route("/logs", get(routes::logs::list))
        .route("/logs/{created_at}", delete(routes::logs::remove))
        .route("/stats", get(routes::stats::get))
        .fallback(|| async { ApiError::NotFound("API が見つかりません".into()) });

    let app = Router::new().nest("/api", api);
    let app = match static_dir {
        // React Router が扱うパス（/logs など）は、ファイルが無いので index.html を返す
        Some(dir) => app
            .fallback_service(ServeDir::new(dir).fallback(ServeFile::new(dir.join("index.html")))),
        None => app,
    };
    app.with_state(state)
}
