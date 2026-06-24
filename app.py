from flask import Flask, render_template, request, session

app = Flask(__name__)
app.secret_key = "Acheron"

@app.route('/')
def index():
    return render_template("index.html")

@app.route('/tasks', methods=["POST"])
def tasks():
    condition = int(request.form["condition"])
    if condition == 0:
        task_list = [
            {"name": "過去問10問", "done": False},
            {"name": "参考書1セクション", "done": False},
            {"name": "復習10分", "done": False},
            {"name": "重要単語メモ10分", "done": False}
        ]
    elif condition == 1:
            task_list = [
            {"name": "過去問20問", "done": False},
            {"name": "参考書2セクション", "done": False},
            {"name": "復習20分", "done": False},
            {"name": "重要単語メモ15分", "done": False}
        ]
    elif condition == 2:
        task_list = [
            {"name": "過去問30問", "done": False},
            {"name": "参考書4セクション", "done": False},
            {"name": "復習30分", "done": False},
            {"name": "重要単語メモ20分", "done": False}
        ]
    return render_template("index.html",tasks = task_list)

@app.route('/start', methods=["POST"])
def start():
    selected_names = request.form.getlist("selected_tasks")
    
    selected_tasks = []
    for name in selected_names:
        selected_tasks.append({"name": name, "done": False})
    
    session["selected_tasks"] = selected_tasks

    return render_template("index.html", tasks=selected_tasks)

if __name__ == "__main__":
    app.run(debug=True)