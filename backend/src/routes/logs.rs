//! 記録の一覧と削除。同じ created_at の行を「1回分」としてまとめる

use axum::Json;
use axum::extract::State;
use axum::http::StatusCode;
use serde::Serialize;

use super::ApiPath;
use crate::AppState;
use crate::db;
use crate::domain::condition_label;
use crate::error::{ApiError, ApiResult};
use crate::session::SessionTask;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogSession {
    created_at: String,
    condition: i64,
    condition_label: &'static str,
    memo: Option<String>,
    tasks: Vec<SessionTask>,
}

#[derive(Serialize)]
pub struct LogsResponse {
    sessions: Vec<LogSession>,
}

/// GET /api/logs — 新しい記録から順
pub async fn list(State(state): State<AppState>) -> ApiResult<Json<LogsResponse>> {
    let rows = db::list_logs(&state.db())?;
    let mut sessions: Vec<LogSession> = Vec::new();
    for row in rows {
        let task = SessionTask {
            name: row.task_name,
            done: row.done,
        };
        match sessions.last_mut() {
            Some(last) if last.created_at == row.created_at && last.condition == row.condition => {
                last.tasks.push(task);
            }
            _ => sessions.push(LogSession {
                created_at: row.created_at,
                condition: row.condition,
                condition_label: condition_label(row.condition),
                memo: row.memo,
                tasks: vec![task],
            }),
        }
    }
    Ok(Json(LogsResponse { sessions }))
}

/// DELETE /api/logs/{created_at} — 1回分の記録をまとめて削除
pub async fn remove(
    State(state): State<AppState>,
    ApiPath(created_at): ApiPath<String>,
) -> ApiResult<StatusCode> {
    match db::delete_logs(&state.db(), &created_at)? {
        0 => Err(ApiError::NotFound("記録が見つかりません".into())),
        _ => Ok(StatusCode::NO_CONTENT),
    }
}
