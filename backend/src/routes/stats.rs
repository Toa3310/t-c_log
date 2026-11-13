//! 統計: 全体・調子ごとの達成率（全期間）と、直近の調子の割合

use axum::Json;
use axum::extract::State;
use serde::Serialize;

use crate::AppState;
use crate::db;
use crate::domain::{CONDITION_ORDER, STATS_RECENT_DAYS, condition_label};
use crate::error::ApiResult;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConditionRate {
    condition: i64,
    label: &'static str,
    /// その調子の記録が無ければ null（0% と区別するため）
    rate: Option<f64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompositionItem {
    condition: i64,
    label: &'static str,
    /// 直近の記録回数
    count: i64,
    /// 直近の記録回数に占める割合（0〜100）
    ratio: f64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatsResponse {
    /// 全体の達成率。記録が1件も無ければ null
    rate: Option<f64>,
    total_tasks: i64,
    done_tasks: i64,
    condition_rates: Vec<ConditionRate>,
    composition: Vec<CompositionItem>,
    recent_total: i64,
    recent_days: u64,
}

/// GET /api/stats
pub async fn get(State(state): State<AppState>) -> ApiResult<Json<StatsResponse>> {
    let rows = db::stats(&state.db(), STATS_RECENT_DAYS)?;
    let rate =
        (rows.total_tasks > 0).then(|| rows.done_tasks as f64 / rows.total_tasks as f64 * 100.0);
    let recent_total: i64 = rows.recent_count_by_condition.iter().map(|(_, n)| n).sum();

    let condition_rates = CONDITION_ORDER
        .iter()
        .map(|&c| ConditionRate {
            condition: c,
            label: condition_label(c),
            rate: rows
                .rate_by_condition
                .iter()
                .find(|(k, _)| *k == c)
                .map(|(_, r)| *r),
        })
        .collect();
    let composition = CONDITION_ORDER
        .iter()
        .map(|&c| {
            let count = rows
                .recent_count_by_condition
                .iter()
                .find(|(k, _)| *k == c)
                .map_or(0, |(_, n)| *n);
            let ratio = if recent_total > 0 {
                count as f64 / recent_total as f64 * 100.0
            } else {
                0.0
            };
            CompositionItem {
                condition: c,
                label: condition_label(c),
                count,
                ratio,
            }
        })
        .collect();

    Ok(Json(StatsResponse {
        rate,
        total_tasks: rows.total_tasks,
        done_tasks: rows.done_tasks,
        condition_rates,
        composition,
        recent_total,
        recent_days: STATS_RECENT_DAYS,
    }))
}
