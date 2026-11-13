//! タスクテンプレート（調子ごとに提案するタスク）の一覧・追加・名前変更・削除

use axum::Json;
use axum::extract::State;
use axum::http::StatusCode;
use serde::{Deserialize, Serialize};

use super::{ApiJson, ApiPath};
use crate::AppState;
use crate::db::{self, TemplateRow};
use crate::domain::{
    CONDITION_ORDER, TASK_NAME_MAX_LENGTH, condition_label, parse_condition, parse_task_name,
};
use crate::error::{ApiError, ApiResult};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateTask {
    id: i64,
    condition: i64,
    name: String,
}

impl From<TemplateRow> for TemplateTask {
    fn from(row: TemplateRow) -> Self {
        Self {
            id: row.id,
            condition: row.condition,
            name: row.name,
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateGroup {
    condition: i64,
    label: &'static str,
    tasks: Vec<TemplateTask>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplatesResponse {
    groups: Vec<TemplateGroup>,
    name_max_length: usize,
}

/// GET /api/templates — 調子ごとにまとめたテンプレート
pub async fn list(State(state): State<AppState>) -> ApiResult<Json<TemplatesResponse>> {
    let mut rows = db::list_templates(&state.db())?;
    let groups = CONDITION_ORDER
        .iter()
        .map(|&condition| {
            let (mine, rest): (Vec<_>, Vec<_>) =
                rows.drain(..).partition(|r| r.condition == condition);
            rows = rest;
            TemplateGroup {
                condition,
                label: condition_label(condition),
                tasks: mine.into_iter().map(TemplateTask::from).collect(),
            }
        })
        .collect();
    Ok(Json(TemplatesResponse {
        groups,
        name_max_length: TASK_NAME_MAX_LENGTH,
    }))
}

#[derive(Deserialize)]
pub struct NewTemplate {
    condition: i64,
    name: String,
}

/// POST /api/templates — {"condition": 0〜2, "name": "..."}
pub async fn create(
    State(state): State<AppState>,
    ApiJson(body): ApiJson<NewTemplate>,
) -> ApiResult<(StatusCode, Json<TemplateTask>)> {
    let condition = parse_condition(body.condition)
        .ok_or_else(|| ApiError::BadRequest("調子は 0〜2 で指定してください".into()))?;
    let name = parse_task_name(&body.name).map_err(ApiError::BadRequest)?;
    let id = db::insert_template(&state.db(), condition, &name)?;
    Ok((
        StatusCode::CREATED,
        Json(TemplateTask {
            id,
            condition,
            name,
        }),
    ))
}

#[derive(Deserialize)]
pub struct Rename {
    name: String,
}

/// PATCH /api/templates/{id} — {"name": "..."}
pub async fn rename(
    State(state): State<AppState>,
    ApiPath(id): ApiPath<i64>,
    ApiJson(body): ApiJson<Rename>,
) -> ApiResult<Json<TemplateTask>> {
    let name = parse_task_name(&body.name).map_err(ApiError::BadRequest)?;
    let row = db::rename_template(&state.db(), id, &name)?
        .ok_or_else(|| ApiError::NotFound("テンプレートが見つかりません".into()))?;
    Ok(Json(row.into()))
}

/// DELETE /api/templates/{id}
pub async fn remove(
    State(state): State<AppState>,
    ApiPath(id): ApiPath<i64>,
) -> ApiResult<StatusCode> {
    match db::delete_template(&state.db(), id)? {
        0 => Err(ApiError::NotFound("テンプレートが見つかりません".into())),
        _ => Ok(StatusCode::NO_CONTENT),
    }
}
