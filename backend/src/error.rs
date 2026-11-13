//! API のエラー。どのエラーも `{"error": "日本語のメッセージ"}` の JSON で返す。

use axum::Json;
use axum::extract::rejection::{JsonRejection, PathRejection};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use serde_json::json;

#[derive(Debug)]
pub enum ApiError {
    /// 入力が正しくない（400）
    BadRequest(String),
    /// 対象が見つからない（404）
    NotFound(String),
    /// 今の状態ではできない操作（409）。例: 進行中のタスクが無いのに完了しようとした
    Conflict(String),
    /// サーバー側の失敗（500）。詳細はログにだけ出し、利用者には出さない
    Internal(String),
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            ApiError::BadRequest(m) => (StatusCode::BAD_REQUEST, m),
            ApiError::NotFound(m) => (StatusCode::NOT_FOUND, m),
            ApiError::Conflict(m) => (StatusCode::CONFLICT, m),
            ApiError::Internal(detail) => {
                eprintln!("[error] {detail}");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "サーバーでエラーが発生しました".to_string(),
                )
            }
        };
        (status, Json(json!({ "error": message }))).into_response()
    }
}

impl From<rusqlite::Error> for ApiError {
    fn from(err: rusqlite::Error) -> Self {
        ApiError::Internal(format!("DB: {err}"))
    }
}

/// JSON の形が違う・Content-Type が無いなどは 400 にする（axum の既定は 415/422 の平文）
impl From<JsonRejection> for ApiError {
    fn from(err: JsonRejection) -> Self {
        ApiError::BadRequest(format!(
            "リクエストの形式が正しくありません（{}）",
            err.body_text()
        ))
    }
}

impl From<PathRejection> for ApiError {
    fn from(_: PathRejection) -> Self {
        ApiError::BadRequest("URL の形式が正しくありません".to_string())
    }
}

pub type ApiResult<T> = Result<T, ApiError>;
