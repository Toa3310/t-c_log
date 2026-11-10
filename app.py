import sqlite3
import os
from datetime import date, datetime, timedelta

from dotenv import load_dotenv
from flask import Flask, redirect, render_template, request, session, url_for

load_dotenv()
app = Flask(__name__)

app.secret_key = os.environ["SECRET_KEY"]
DB_PATH = os.environ["DB_PATH"]

CONDITION_LABELS = {0: "よくない", 1: "普通", 2: "良い"}
CONDITION_COLORS = {0: "#0067C0", 1: "#F58220", 2: "#00B16B"}
TASK_NAME_MAX_LENGTH = 50
STATS_RECENT_DAYS = 30

def parse_condition(value):
    """フォームの値を調子（0/1/2）に変換する。不正な値なら None を返す。"""
    try:
        condition = int(value)
    except (TypeError, ValueError):
        return None
    if condition not in CONDITION_LABELS:
        return None
    return condition

def parse_task_name(value):
    """タスク名の前後の空白を除き、空や長すぎる場合は None を返す。"""
    name = (value or "").strip()
    if not name or len(name) > TASK_NAME_MAX_LENGTH:
        return None
    return name

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS task_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            condition INTEGER NOT NULL,
            task_name TEXT NOT NULL,
            done INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            memo TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS task_templates (
            id INTEGER  PRIMARY KEY AUTOINCREMENT,
            condition INTEGER NOT NULL,
            name TEXT NOT NULL
        )
    """)
    count = conn.execute("SELECT COUNT(*) FROM task_templates").fetchone()[0]
    if count == 0:
        initial_data = {
            0: ["過去問10問", "参考書1セクション", "復習10分", "単語メモ10分"],
            1: ["過去問20問", "参考書2セクション", "復習20分", "単語メモ15分"],
            2: ["過去問30問", "参考書3セクション", "復習30分", "単語メモ20分"],
        }
        for condition, names in initial_data.items():
            for name in names:
                conn.execute("INSERT INTO task_templates (condition, name) VALUES (?, ?)", (condition, name))
    columns = [row["name"] for row in conn.execute("PRAGMA table_info(task_logs)")]
    if "memo" not in columns:
        conn.execute("ALTER TABLE task_logs ADD COLUMN memo TEXT")
    conn.commit()
    conn.close()

init_db()

def save_logs(selected_tasks, condition, memo):
    today = date.today().isoformat()
    now = datetime.now().isoformat()
    conn = get_db()
    for task in selected_tasks:
        conn.execute(
            "INSERT INTO task_logs (date, condition, task_name, done, created_at, memo) VALUES (?, ?, ?, ?, ?, ?)",
            (today, condition, task["name"], int(task["done"]), now, memo)
        )
    conn.commit()
    conn.close()

def completion_rate(tasks):
    if not tasks:
        return 0
    done_count = sum(1 for task in tasks if task["done"])
    return done_count / len(tasks) * 100

def make_tasks(condition):
    conn = get_db()
    rows = conn.execute("SELECT id, name FROM task_templates WHERE condition = ? ORDER BY id", (condition,)).fetchall()
    conn.close()

    tasks = []
    for row in rows:
        tasks.append({"id": row["id"], "name": row["name"], "done": False})
    return tasks

@app.route('/')
def index():
    return render_template("index.html")

@app.route('/tasks', methods=["POST"])
def tasks():
    condition = parse_condition(request.form.get("condition"))
    if condition is None:
        return redirect(url_for("index"))
    task_list = make_tasks(condition)
    return render_template("index.html", tasks=task_list, condition=condition)

@app.route('/start', methods=["POST"])
def start():
    condition = parse_condition(request.form.get("condition"))
    if condition is None:
        return redirect(url_for("index"))
    task_list = make_tasks(condition)
    # チェックボックスの値はテンプレートの id。DB にある id だけを採用し、表示順を保つ
    selected_ids = set(request.form.getlist("selected_tasks"))
    selected_tasks = []
    for task in task_list:
        if str(task["id"]) in selected_ids:
            selected_tasks.append({"name": task["name"], "done": False})
    if not selected_tasks:
        return render_template("index.html", tasks=task_list, condition=condition, message="タスクを1つ以上選択してください")
    session["selected_tasks"] = selected_tasks
    session["condition"] = condition
    return render_template("start.html", tasks=selected_tasks, rate=completion_rate(selected_tasks))

@app.route('/complete', methods=["POST"])
def complete():
    selected_tasks = session.get("selected_tasks")
    if not selected_tasks:
        return redirect(url_for("index"))
    # 同名タスクがあっても1つだけ完了にできるよう、名前ではなく位置で指定する
    task_index = request.form.get("task_index", type=int)
    if task_index is not None and 0 <= task_index < len(selected_tasks):
        selected_tasks[task_index]["done"] = True
    session["selected_tasks"] = selected_tasks
    rate = completion_rate(selected_tasks)
    all_done = all(task["done"] for task in selected_tasks)
    if all_done:
        return render_template("complete.html", tasks=selected_tasks, rate=rate)

    return render_template("start.html", tasks=selected_tasks, rate=rate)

@app.route('/cancel', methods=["POST"])
def cancel():
    selected_tasks = session.get("selected_tasks")
    if not selected_tasks:
        return redirect(url_for("index"))
    rate = completion_rate(selected_tasks)
    return render_template("cancel.html", tasks=selected_tasks, rate=rate)

@app.route('/save', methods=["POST"])
def save():
    memo = request.form.get("memo", "").strip()
    selected_tasks = session.get("selected_tasks", [])
    condition = session.get("condition")
    if selected_tasks:
        save_logs(selected_tasks, condition, memo)
    session.pop("selected_tasks", None)
    session.pop("condition", None)
    return redirect(url_for("logs"))

@app.route('/logs')
def logs():
    conn = get_db()
    rows = conn.execute("SELECT * FROM task_logs ORDER BY created_at DESC, id ASC").fetchall()
    conn.close()
    sessions = []
    for row in rows:
        key = (row["condition"], row["created_at"])
        if sessions and sessions[-1]["key"] == key:
            sessions[-1]["tasks"].append(row)
        else:
            sessions.append({"key": key, "condition": CONDITION_LABELS[row["condition"]], "created_at": row["created_at"], "memo": row["memo"], "tasks": [row]})
    return render_template("logs.html", sessions=sessions)

@app.route('/logs/delete', methods=["POST"])
def delete_log():
    created_at = request.form["created_at"]
    conn = get_db()
    conn.execute("DELETE FROM task_logs WHERE created_at = ?", (created_at,))
    conn.commit()
    conn.close()
    return redirect(url_for("logs"))

@app.route('/templates')
def templates():
    conn = get_db()
    rows = conn.execute("SELECT id, condition, name FROM task_templates ORDER BY id").fetchall()
    conn.close()
    groups=[]
    for condition in [2, 1, 0]:
        tasks = [row for row in rows if row["condition"] == condition]
        groups.append({"condition": CONDITION_LABELS[condition], "tasks": tasks})
    return render_template("task_templates.html", groups=groups, name_max_length=TASK_NAME_MAX_LENGTH)

@app.route('/templates/delete', methods=["POST"])
def delete_template():
    template_id = request.form.get("id", type=int)
    if template_id is None:
        return redirect(url_for("templates"))
    conn = get_db()
    conn.execute("DELETE FROM task_templates WHERE id = ?", (template_id,))
    conn.commit()
    conn.close()
    return redirect(url_for("templates"))

@app.route('/templates/add', methods=["POST"])
def add_template():
    condition = parse_condition(request.form.get("condition"))
    task_name = parse_task_name(request.form.get("name"))
    if condition is None or task_name is None:
        return redirect(url_for("templates"))
    conn = get_db()
    conn.execute("INSERT INTO task_templates (condition, name) VALUES (?, ?)", (condition, task_name))
    conn.commit()
    conn.close()
    return redirect(url_for("templates"))

@app.route('/templates/edit', methods=["POST"])
def edit_template():
    template_id = request.form.get("id", type=int)
    name = parse_task_name(request.form.get("name"))
    if template_id is None or name is None:
        return redirect(url_for("templates"))
    conn = get_db()
    conn.execute("UPDATE task_templates SET name = ? WHERE id = ?", (name, template_id))
    conn.commit()
    conn.close()
    return redirect(url_for("templates"))

@app.route('/stats')
def stats():
    standard_day = date.today() - timedelta(days=STATS_RECENT_DAYS)
    iso_day = standard_day.isoformat()
    rate_list = []
    composition_list = []

    conn = get_db()
    all_row = conn.execute("SELECT AVG(done) * 100 FROM task_logs").fetchone()
    rate_row = conn.execute("SELECT condition, AVG(done) * 100 FROM task_logs GROUP BY condition").fetchall()
    count_rows = conn.execute("SELECT condition, COUNT(DISTINCT created_at) FROM task_logs WHERE date >= ? GROUP BY condition", (iso_day,)).fetchall()
    conn.close()

    # 記録が1件もなければ None（テンプレート側で「まだ記録がありません」と表示する）
    all_ach = all_row[0]
    rate_by_condition = {}
    count_by_condition = {}
    for r in rate_row:
        rate_by_condition[r[0]] = r[1]
    for row in count_rows:
        count_by_condition[row[0]] = row[1]
    total = sum(count_by_condition.values())
    for c in [2,1,0]:
        # その調子の記録がなければ None（0% と区別するため）
        achieve_rate = rate_by_condition.get(c)
        condition_ratio = (count_by_condition.get(c,0) / total) * 100 if total != 0 else 0
        rate_list.append({"label": CONDITION_LABELS[c],"rate": achieve_rate,})
        composition_list.append({"label": CONDITION_LABELS[c], "color": CONDITION_COLORS[c] , "ratio": condition_ratio})

    # 直近の記録がないと全区間 0% になり、conic-gradient が最後の色で塗りつぶされてしまうので描画しない
    pie = None
    if total != 0:
        cumulative = 0
        parts = []
        for item in composition_list:
            start = cumulative
            cumulative += item["ratio"]
            end = cumulative
            parts.append(f"{item['color']} {start}% {end}%")
        pie = "conic-gradient(" + ", ".join(parts) + ")"

    return render_template("stats.html", rate=all_ach, condition_by_rates=rate_list, composition_ratio=composition_list, pie=pie, recent_days=STATS_RECENT_DAYS)

if __name__ == "__main__":
    app.run(debug=True)