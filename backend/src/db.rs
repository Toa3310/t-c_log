//! SQLite へのアクセス。テーブル構成は Flask 版と同じなので、以前の DB ファイルをそのまま使える。

use chrono::{Days, Local};
use rusqlite::{Connection, OptionalExtension, params};

use crate::session::ActiveSession;

/// 初回起動時に入れておくタスクテンプレート（調子 → タスク名）
const INITIAL_TEMPLATES: [(i64, [&str; 4]); 3] = [
    (
        0,
        [
            "過去問10問",
            "参考書1セクション",
            "復習10分",
            "単語メモ10分",
        ],
    ),
    (
        1,
        [
            "過去問20問",
            "参考書2セクション",
            "復習20分",
            "単語メモ15分",
        ],
    ),
    (
        2,
        [
            "過去問30問",
            "参考書3セクション",
            "復習30分",
            "単語メモ20分",
        ],
    ),
];

/// DB を開き、テーブルが無ければ作る
pub fn open(path: &str) -> rusqlite::Result<Connection> {
    let conn = Connection::open(path)?;
    init(&conn)?;
    Ok(conn)
}

pub fn init(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS task_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            condition INTEGER NOT NULL,
            task_name TEXT NOT NULL,
            done INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            memo TEXT
        );
        CREATE TABLE IF NOT EXISTS task_templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            condition INTEGER NOT NULL,
            name TEXT NOT NULL
        );",
    )?;

    // memo 列が無い古い DB 向けの移行
    let has_memo = conn
        .prepare("SELECT 1 FROM pragma_table_info('task_logs') WHERE name = 'memo'")?
        .exists([])?;
    if !has_memo {
        conn.execute("ALTER TABLE task_logs ADD COLUMN memo TEXT", [])?;
    }

    let count: i64 = conn.query_row("SELECT COUNT(*) FROM task_templates", [], |r| r.get(0))?;
    if count == 0 {
        for (condition, names) in INITIAL_TEMPLATES {
            for name in names {
                conn.execute(
                    "INSERT INTO task_templates (condition, name) VALUES (?1, ?2)",
                    params![condition, name],
                )?;
            }
        }
    }
    Ok(())
}

// ---- タスクテンプレート ----

pub struct TemplateRow {
    pub id: i64,
    pub condition: i64,
    pub name: String,
}

pub fn list_templates(conn: &Connection) -> rusqlite::Result<Vec<TemplateRow>> {
    let mut stmt = conn.prepare("SELECT id, condition, name FROM task_templates ORDER BY id")?;
    let rows = stmt.query_map([], |r| {
        Ok(TemplateRow {
            id: r.get(0)?,
            condition: r.get(1)?,
            name: r.get(2)?,
        })
    })?;
    rows.collect()
}

pub fn insert_template(conn: &Connection, condition: i64, name: &str) -> rusqlite::Result<i64> {
    conn.execute(
        "INSERT INTO task_templates (condition, name) VALUES (?1, ?2)",
        params![condition, name],
    )?;
    Ok(conn.last_insert_rowid())
}

/// 名前を変更し、変更後の行を返す（該当 id が無ければ None）
pub fn rename_template(
    conn: &Connection,
    id: i64,
    name: &str,
) -> rusqlite::Result<Option<TemplateRow>> {
    conn.execute(
        "UPDATE task_templates SET name = ?1 WHERE id = ?2",
        params![name, id],
    )?;
    conn.query_row(
        "SELECT id, condition, name FROM task_templates WHERE id = ?1",
        [id],
        |r| {
            Ok(TemplateRow {
                id: r.get(0)?,
                condition: r.get(1)?,
                name: r.get(2)?,
            })
        },
    )
    .optional()
}

/// 削除した行数を返す
pub fn delete_template(conn: &Connection, id: i64) -> rusqlite::Result<usize> {
    conn.execute("DELETE FROM task_templates WHERE id = ?1", [id])
}

// ---- 記録 ----

/// 進行中のタスクを記録として保存し、記録の created_at を返す。
/// 1回分のタスクは同じ created_at を持ち、これで1回分としてまとめる（Flask 版と同じ）
pub fn save_logs(
    conn: &mut Connection,
    session: &ActiveSession,
    memo: &str,
) -> rusqlite::Result<String> {
    let now = Local::now().naive_local();
    let today = now.format("%Y-%m-%d").to_string();
    let created_at = now.format("%Y-%m-%dT%H:%M:%S%.6f").to_string();
    let tx = conn.transaction()?;
    for task in &session.tasks {
        tx.execute(
            "INSERT INTO task_logs (date, condition, task_name, done, created_at, memo)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                today,
                session.condition,
                task.name,
                task.done,
                created_at,
                memo
            ],
        )?;
    }
    tx.commit()?;
    Ok(created_at)
}

pub struct LogRow {
    pub condition: i64,
    pub task_name: String,
    pub done: bool,
    pub created_at: String,
    pub memo: Option<String>,
}

/// 新しい記録から順。1回分の中はタスクを選んだ順
pub fn list_logs(conn: &Connection) -> rusqlite::Result<Vec<LogRow>> {
    let mut stmt = conn.prepare(
        "SELECT condition, task_name, done, created_at, memo FROM task_logs
         ORDER BY created_at DESC, id ASC",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok(LogRow {
            condition: r.get(0)?,
            task_name: r.get(1)?,
            done: r.get(2)?,
            created_at: r.get(3)?,
            memo: r.get(4)?,
        })
    })?;
    rows.collect()
}

pub fn delete_logs(conn: &Connection, created_at: &str) -> rusqlite::Result<usize> {
    conn.execute("DELETE FROM task_logs WHERE created_at = ?1", [created_at])
}

// ---- 統計 ----

pub struct StatsRows {
    pub total_tasks: i64,
    pub done_tasks: i64,
    /// (調子, 達成率%)
    pub rate_by_condition: Vec<(i64, f64)>,
    /// (調子, 直近の記録回数)
    pub recent_count_by_condition: Vec<(i64, i64)>,
}

pub fn stats(conn: &Connection, recent_days: u64) -> rusqlite::Result<StatsRows> {
    let since = (Local::now().date_naive() - Days::new(recent_days))
        .format("%Y-%m-%d")
        .to_string();
    let (total_tasks, done_tasks) = conn.query_row(
        "SELECT COUNT(*), COALESCE(SUM(done), 0) FROM task_logs",
        [],
        |r| Ok((r.get(0)?, r.get(1)?)),
    )?;
    let rate_by_condition = conn
        .prepare("SELECT condition, AVG(done) * 100 FROM task_logs GROUP BY condition")?
        .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?
        .collect::<rusqlite::Result<_>>()?;
    let recent_count_by_condition = conn
        .prepare(
            "SELECT condition, COUNT(DISTINCT created_at) FROM task_logs
             WHERE date >= ?1 GROUP BY condition",
        )?
        .query_map([since], |r| Ok((r.get(0)?, r.get(1)?)))?
        .collect::<rusqlite::Result<_>>()?;
    Ok(StatsRows {
        total_tasks,
        done_tasks,
        rate_by_condition,
        recent_count_by_condition,
    })
}
