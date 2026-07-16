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
    if condition == 0:
        return [
            {"name": "過去問10問", "done": False},
            {"name": "参考書1セクション", "done": False},
            {"name": "復習10分", "done": False},
            {"name": "重要単語メモ10分", "done": False}
        ]
    elif condition == 1:
        return [
            {"name": "過去問20問", "done": False},
            {"name": "参考書2セクション", "done": False},
            {"name": "復習20分", "done": False},
            {"name": "重要単語メモ15分", "done": False}
        ]
    elif condition == 2:
        return [
            {"name": "過去問30問", "done": False},
            {"name": "参考書4セクション", "done": False},
            {"name": "復習30分", "done": False},
            {"name": "重要単語メモ20分", "done": False}
        ]
    return []

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

@app.route('/delete', methods=["POST"])
def delete():
    created_at = request.form["created_at"]

    conn = get_db()
    conn.execute("DELETE FROM task_logs WHERE created_at = ?", (created_at,))
    conn.commit()
    conn.close()

    return redirect(url_for("logs"))

if __name__ == "__main__":
    app.run(debug=True)