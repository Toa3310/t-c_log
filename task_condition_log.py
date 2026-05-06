def task_in_progress(task):
    task_end = False
    check = input("作業が完了した場合はcを、とちゅう")

task = ""
option = input("---今日やることを1つ選択してください---\n1. 過去問を20問解く\n2. 昨日の復習\n3. テキスト/参考書1セクション\n4. 重要単語をまとめる\n")

if option == "1":
    task = "過去問20問"
elif option == "2":
    task = "昨日の復習"
elif option == "3":
    task = "テキスト/参考書1セクション"
elif option == "4":
    task = "重要単語まとめ"
else:
    print("入力は1~4でお願いします")