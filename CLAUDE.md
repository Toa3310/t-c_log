# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

TaskCondition は、その日の「コンディション」（集中度・気分：よくない／普通／いい）に応じて学習タスクを提案する、小規模な Flask 学習用プロジェクトです。タスクを単独で管理するのではなく、その日のコンディションと結びつける点が特徴です。現在は CLI 版プロトタイプから Flask を用いた Web アプリへ移行中です。コミットメッセージやテンプレート内の文言は日本語が基本なので、ドキュメントやコミットメッセージも日本語で書くこと。

## コマンド

- Web アプリの起動: `python app.py`（Flask 開発サーバー、debug モード、デフォルトで `http://localhost:5000`）
- 依存関係のインストール: `pip install -r requirements.txt`
- CLI 版プロトタイプの実行: `python task_condition_log.py`

lint・ビルド・テストの仕組みは何も設定されていない（pytest なし、JS ツールチェーンなし、CI なし）。

## アーキテクチャ

- `app.py` — Flask アプリ本体。ルーティング、セッションベースの状態管理、タスクテンプレートがすべてこの1ファイルに収まっている。Blueprint やビジネスロジック用の別モジュールには分割されていない。
- `templates/index.html`、`templates/start.html`、`templates/complete.html` — Jinja2 テンプレート。CSS/JS アセットは無し。
- `task_condition_log.py` — スタンドアロンの CLI プロトタイプ（`input()` による対話型）。`app.py` のロジックはここから移植されたもの。`completion_rate` やタスクテンプレートのロジックが `app.py` と重複しており、`app.py` からこれを import してはいない。片方を修正する際はもう片方にも同じ修正が必要か確認すること。

### リクエストフロー（セッションを使ったステートマシン）

状態（`selected_tasks`：`{"name", "done"}` の辞書のリスト）はすべて Flask セッションクッキーに保持される。データベースやクライアント側の JS/localStorage は使用していない。

1. `GET /` → `index.html` — コンディション（0/1/2）選択ボタンを表示。
2. `POST /tasks` → `make_tasks(condition)` がコンディションごとの固定タスクリストを返し、`index.html` をチェックボックス付きで再描画（コンディションは hidden input で引き継ぐ）。
3. `POST /start` → 選択されたチェックボックスを読み取り、1つ以上選択されているかサーバー側でバリデーション（HTML の `required` だけではチェックボックスグループの最小選択数を強制できないため）。`session["selected_tasks"]` に保存し、進捗率とともに `start.html` を描画。
4. `POST /complete` → タスク名で該当タスクを完了状態にし、進捗率を再計算。すべて完了していれば `complete.html` を、そうでなければ更新後の `start.html` を描画する。同じルートでも状態によって返すテンプレートが分岐する点に注意。

### 既知の粗さ（学習用プロジェクトゆえの意図的なもの — 指摘はしても、指示なく勝手に直さないこと）

- `app.secret_key` は `app.py` 内にハードコード（`"Acheron"`）されている。`.gitignore` は既に `.env` を除外しており、将来的に環境変数管理へ移行する想定と思われる。
- タスクテンプレートはハードコードされており、`app.py` と `task_condition_log.py` の間で重複している。
- 永続化層はまだ無い。README のロードマップでは SQLite/SQLAlchemy 導入、グラフ可視化、ログイン機能が予定されている。
