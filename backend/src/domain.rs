//! アプリの決まりごと（調子の種類、入力の検証、達成率の計算）。DB や HTTP には依存しない。

/// 調子（コンディション）。DB には 0/1/2 の整数で保存する。
pub const CONDITION_LABELS: [&str; 3] = ["よくない", "普通", "良い"];
/// 画面に並べる順（良い → よくない）
pub const CONDITION_ORDER: [i64; 3] = [2, 1, 0];

pub const TASK_NAME_MAX_LENGTH: usize = 50;
pub const MEMO_MAX_LENGTH: usize = 200;
pub const STATS_RECENT_DAYS: u64 = 30;
/// 1回に選べるタスクの上限。進行中の状態は Cookie に入れるので、大きくなりすぎないようにする
pub const MAX_SESSION_TASKS: usize = 10;

pub fn condition_label(condition: i64) -> &'static str {
    usize::try_from(condition)
        .ok()
        .and_then(|i| CONDITION_LABELS.get(i))
        .copied()
        .unwrap_or("不明")
}

/// 0/1/2 のどれかなら Some を返す
pub fn parse_condition(value: i64) -> Option<i64> {
    (0..=2).contains(&value).then_some(value)
}

/// タスク名の前後の空白を除く。空や長すぎる場合はエラーメッセージを返す
pub fn parse_task_name(value: &str) -> Result<String, String> {
    let name = value.trim();
    if name.is_empty() {
        return Err("タスク名を入力してください".into());
    }
    if name.chars().count() > TASK_NAME_MAX_LENGTH {
        return Err(format!(
            "タスク名は{TASK_NAME_MAX_LENGTH}文字以内で入力してください"
        ));
    }
    Ok(name.to_string())
}

/// メモの前後の空白を除き、上限を超えた分は切り捨てる
pub fn normalize_memo(value: &str) -> String {
    value.trim().chars().take(MEMO_MAX_LENGTH).collect()
}

/// 完了したタスクの割合（0〜100）。タスクが無ければ 0
pub fn completion_rate(done_flags: impl IntoIterator<Item = bool>) -> f64 {
    let (done, total) = done_flags
        .into_iter()
        .fold((0usize, 0usize), |(done, total), d| {
            (done + usize::from(d), total + 1)
        });
    if total == 0 {
        0.0
    } else {
        done as f64 / total as f64 * 100.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn condition_must_be_0_to_2() {
        assert_eq!(parse_condition(0), Some(0));
        assert_eq!(parse_condition(2), Some(2));
        assert_eq!(parse_condition(3), None);
        assert_eq!(parse_condition(-1), None);
    }

    #[test]
    fn task_name_is_trimmed_and_limited() {
        assert_eq!(parse_task_name("  過去問10問 ").unwrap(), "過去問10問");
        assert!(parse_task_name("   ").is_err());
        assert!(parse_task_name(&"あ".repeat(50)).is_ok());
        assert!(parse_task_name(&"あ".repeat(51)).is_err());
    }

    #[test]
    fn memo_is_truncated_by_characters() {
        assert_eq!(
            normalize_memo(&"あ".repeat(300)).chars().count(),
            MEMO_MAX_LENGTH
        );
        assert_eq!(normalize_memo("  寝不足 "), "寝不足");
    }

    #[test]
    fn completion_rate_handles_empty() {
        assert_eq!(completion_rate([]), 0.0);
        assert_eq!(completion_rate([true, false, false, true]), 50.0);
    }
}
