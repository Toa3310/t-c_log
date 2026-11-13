def display_task(tasks):
    for i, task in enumerate(tasks, start=1):
        print(f"{i}: {task['name']}")

def display_task_status(tasks):
    for i, task in enumerate(tasks, start=1):

        # 完了済みなら〇を付ける
        if task["done"]:
            status = "〇"
        else:
            status = "×"

        print(f"{i}: {task['name']} [{status}]")

def completion_rate(tasks):
    if not tasks:
        return 0
    count = 0
    for task in tasks:
        if task["done"]:
            count += 1
    return count / len(tasks) * 100

tasks = []

# 0/1/2 以外が入力されたら再入力してもらう
while True:
    condition_input = input("今日のコンディションを入力してください(0:良くない,1:普通,2:良い): ").strip()
    if condition_input in ("0", "1", "2"):
        condition = int(condition_input)
        break
    print("0,1,2のどれかを入力してください")

if condition == 0:
    tasks = [
        {"name": "過去問10問", "done": False},
        {"name": "参考書1セクション", "done": False},
        {"name": "昨日の復習10分", "done": False},
        {"name": "重要単語メモ10分", "done": False}
    ]

elif condition == 1:
    tasks = [
        {"name": "過去問20問", "done": False},
        {"name": "参考書2セクション", "done": False},
        {"name": "復習20分", "done": False},
        {"name": "重要単語メモ15分", "done": False}
    ]

else:
    tasks = [
        {"name": "過去問30問", "done": False},
        {"name": "参考書4セクション", "done": False},
        {"name": "復習30分", "done": False},
        {"name": "重要単語メモ20分", "done": False}
    ]


print("\n-タスク一覧-")
display_task(tasks)


# 範囲内の番号が1つ以上入力されるまで繰り返す（重複は1回だけ採用）
while True:
    selected_tasks = []
    for s in input("\n今日行うタスクを選択してください(例:1 2): ").split():
        if s.isdecimal() and 1 <= int(s) <= len(tasks) and tasks[int(s) - 1] not in selected_tasks:
            selected_tasks.append(tasks[int(s) - 1])
    if selected_tasks:
        break
    print(f"1〜{len(tasks)}の番号を1つ以上入力してください")

# 完了処理
while True:
    print("\n今日の学習を始めます")
    print("-現在のタスク状況-")
    display_task_status(selected_tasks)

    c_rate = completion_rate(selected_tasks)
    print(f"進捗: {c_rate}%")

    user_input = input("\n完了したタスク番号を入力(qで終了): ").strip()

    if user_input == "q":
        print("終了します")
        break

    if not (user_input.isdecimal() and 1 <= int(user_input) <= len(selected_tasks)):
        print(f"1〜{len(selected_tasks)}の番号かqを入力してください")
        continue

    num = int(user_input)

    # 完了状態をTrueに変更
    selected_tasks[num - 1]["done"] = True

    print(f"{selected_tasks[num - 1]['name']} が完了しました！")

    # 全タスク完了チェック
    all_done = all(task["done"] for task in selected_tasks)

    if all_done:
        print("\n進捗が100%になりました！")
        print("すべてのタスクが完了しました！")
        break