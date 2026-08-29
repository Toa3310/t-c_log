import sqlite3
import os
from datetime import date, datetime

from dotenv import load_dotenv
from flask import Flask, redirect, render_template, request, session, url_for

load_dotenv()
app = Flask(__name__)

app.secret_key = os.environ["SECRET_KEY"]
DB_PATH = os.environ["DB_PATH"]

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

CONDITION_LABELS = {0: "よくない", 1: "普通", 2: "良い"}

def make_tasks(condition):
    conn = get_db()
    rows = conn.execute("SELECT name FROM task_templates WHERE condition = ?", (condition,)).fetchall()
    conn.close()

    tasks = []
    for row in rows:
        tasks.append({"name": row["name"], "done": False})
    return tasks

@app.route('/')
def index():
    return render_template("index.html")

@app.route('/tasks', methods=["POST"])
def tasks():
    condition = int(request.form["condition"])
    task_list = make_tasks(condition)
    return render_template("index.html", tasks=task_list, condition=condition)

@app.route('/start', methods=["POST"])
def start():
    selected_names = request.form.getlist("selected_tasks")
    condition = int(request.form["condition"])
    if not selected_names:
        task_list = make_tasks(condition)
        return render_template("index.html", tasks=task_list, condition=condition, message="タスクを1つ以上選択してください")
    selected_tasks = []
    for name in selected_names:
        selected_tasks.append({"name": name, "done": False})
    session["selected_tasks"] = selected_tasks
    session["condition"] = condition
    return render_template("start.html", tasks=selected_tasks, rate=completion_rate(selected_tasks))

@app.route('/complete', methods=["POST"])
def complete():
    task_name = request.form["task_name"]
    selected_tasks = session.get("selected_tasks", [])
    for task in selected_tasks:
        if task["name"] == task_name:
            task["done"] = True
    session["selected_tasks"] = selected_tasks
    rate = completion_rate(selected_tasks)
    all_done = all(task["done"] for task in selected_tasks)
    if all_done:
        return render_template("complete.html", tasks=selected_tasks, rate=rate)

    return render_template("start.html", tasks=selected_tasks, rate=rate)

@app.route('/cancel', methods=["POST"])
def cancel():
    selected_tasks = session.get("selected_tasks", [])
    rate = completion_rate(selected_tasks)
    return render_template("cancel.html", tasks=selected_tasks, rate=rate)

@app.route('/save', methods=["POST"])
def save():
    memo = request.form.get("memo", "")
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
    rows = conn.execute("SELECT * FROM task_logs ORDER BY id DESC").fetchall()
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
    rows = conn.execute("SELECT id, condition, name FROM task_templates").fetchall()
    conn.close()
    groups=[]
    for condition in [2, 1, 0]:
        tasks = [row for row in rows if row["condition"] == condition]
        groups.append({"condition": CONDITION_LABELS[condition], "tasks": tasks})
    return render_template("task_templates.html", groups=groups)

@app.route('/templates/delete', methods=["POST"])
def delete_template():
    template_id = request.form["id"]
    conn = get_db()
    conn.execute("DELETE FROM task_templates WHERE id = ?", (template_id,))
    conn.commit()
    conn.close()
    return redirect(url_for("templates"))

@app.route('/templates/add', methods=["POST"])
def add_template():
    condition = request.form["condition"]
    task_name = request.form["name"]
    conn = get_db()
    conn.execute("INSERT INTO task_templates (condition, name) VALUES (?, ?)", (condition, task_name))
    conn.commit()
    conn.close()
    return redirect(url_for("templates"))

@app.route('/templates/edit', methods=["POST"])
def edit_template():
    id = request.form["id"]
    name = request.form["name"]
    conn = get_db()
    conn.execute("UPDATE task_templates SET name = ? WHERE id = ?", (name, id))
    conn.commit()
    conn.close()
    return redirect(url_for("templates"))

@app.route('/stats')
def stats():
    condition_rates = []
    conn = get_db()
    zentai = conn.execute("SELECT AVG(done) * 100 FROM task_logs").fetchone()
    row = conn.execute("SELECT condition, AVG(done) * 100 FROM task_logs GROUP BY condition").fetchall()
    conn.close()
    ach_rate = zentai[0]
    if ach_rate is None:
        ach_rate = 0
    d = {}
    for r in row:
        d[r[0]] = r[1]
    for c in [2,1,0]:
        rate = d.get(c, 0)
        condition_rates.append({"label": CONDITION_LABELS[c],"rate": rate,})
    return render_template("stats.html", rate=ach_rate,condition_rates=condition_rates)

if __name__ == "__main__":
    app.run(debug=True)