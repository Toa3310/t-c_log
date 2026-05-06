def display_task(tasks):
    print("-タスク一覧-")
    for i, task in enumerate(tasks, start=1):
        print(f"{i}: {task}")

tasks = ""
condition = int(input("今日のコンディションを入力してください(0:良くない,1:普通,2:良い): "))

if condition == 0:
    tasks = ["過去問10問", "参考書1セクション", "昨日の復習10分", "重要単語メモ10分"]
elif condition == 1:
    tasks = ["過去問20問", "参考書2セクション", "復習20分", "重要単語メモ15分"]
elif condition == 2:
    tasks = ["過去問30問", "参考書4セクション", "復習30分", "重要単語メモ20分"]
else:
    print("0,1,2のどれかを入力してください")

display_task(tasks)

