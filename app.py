from flask import Flask, render_template, request, session

app = Flask(__name__)
app.secret_key = "Acheron"

def completion_rate(tasks):
    if not tasks:
        return 0
    done_count = sum(1 for task in tasks if task["done"])
    return done_count / len(tasks) * 100

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

    if not selected_names:
        condition = int(request.form["condition"])
        task_list = make_tasks(condition)
        return render_template("index.html", tasks=task_list, condition=condition, message="タスクを1つ以上選択してください")

    selected_tasks = []
    for name in selected_names:
        selected_tasks.append({"name": name, "done": False})

    session["selected_tasks"] = selected_tasks

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

if __name__ == "__main__":
    app.run(debug=True)