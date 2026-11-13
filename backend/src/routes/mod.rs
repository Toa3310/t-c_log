//! API のハンドラー

pub mod logs;
pub mod session;
pub mod stats;
pub mod templates;

use axum::extract::{FromRequest, FromRequestParts};

use crate::error::ApiError;

/// axum::Json と同じだが、失敗したときに ApiError（日本語の JSON エラー）を返す
#[derive(FromRequest)]
#[from_request(via(axum::Json), rejection(ApiError))]
pub struct ApiJson<T>(pub T);

/// axum::extract::Path と同じだが、失敗したときに ApiError を返す
#[derive(FromRequestParts)]
#[from_request(via(axum::extract::Path), rejection(ApiError))]
pub struct ApiPath<T>(pub T);
