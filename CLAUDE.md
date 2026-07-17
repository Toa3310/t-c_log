# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

tascon（仮称） は、その日の「調子（コンディション）」（集中度・気分：よくない／普通／いい）に応じて学習タスクを提案する、小規模な Flask 学習用プロジェクトです。タスクを単独で管理するのではなく、その日のコンディションと結びつける点が特徴です。現在は CLI 版プロトタイプから Flask を用いた Web アプリへ移行中です。コミットメッセージやテンプレート内の文言は日本語が基本なので、ドキュメントやコミットメッセージも日本語で書くこと。

## コマンド

- Web アプリの起動: `python app.py`（Flask 開発サーバー、debug モード、デフォルトで `http://localhost:5000`）
- 依存関係のインストール: `pip install -r requirements.txt`
- CLI 版プロトタイプの実行: `python task_condition_log.py`

lint・ビルド・テストの仕組みは何も設定されていない（pytest なし、JS ツールチェーンなし、CI なし）。

## アーキテクチャ

- `app.py` — Flask アプリ本体。ルーティング、セッションベースの状態管理、タスクテンプレートがすべてこの1ファイルに収まっている。Blueprint やビジネスロジック用の別モジュールには分割されていない。
- `templates/index.html`、`templates/start.html`、`templates/complete.html`、 `templates/base.html`、 `templates/cancel.html`、 `templates/logs.html` — Jinja2 テンプレート。CSSは `static/style.css` を導入、JSはなし。
- `task_condition_log.py` — スタンドアロンの CLI プロトタイプ（`input()` による対話型）。`app.py` のロジックはここから移植されたもの。`completion_rate` やタスクテンプレートのロジックが `app.py` と重複しており、`app.py` からこれを import してはいない。片方を修正する際はもう片方にも同じ修正が必要か確認すること。

### リクエストフロー（セッションを使ったステートマシン）

作業中の状態（`selected_tasks`）はセッション、確定した記録（`task_logs`）はSQLiteに保存する。JS/localStorageは使わない

1. `GET /` → `index.html` — コンディション（0/1/2）選択ボタンを表示。
2. `POST /tasks` → `make_tasks(condition)` がコンディションごとの固定タスクリストを返し、`index.html` をチェックボックス付きで再描画（コンディションは hidden input で引き継ぐ）。
3. `POST /start` → 選択されたチェックボックスを読み取り、1つ以上選択されているかサーバー側でバリデーション（HTML の `required` だけではチェックボックスグループの最小選択数を強制できないため）。`session["selected_tasks"]` に保存し、進捗率とともに `start.html` を描画。
4. `POST /complete` → タスク名で該当タスクを完了状態にし、進捗率を再計算。すべて完了していれば `complete.html` を、そうでなければ更新後の `start.html` を描画する。同じルートでも状態によって返すテンプレートが分岐する点に注意。
5. `POST /cancel` → セッションの `selected_tasks` を読み、進捗率とともにcancel.html(途中終了画面)を表示。ここではまだDBに保存しない。
6. `POST /save` → フォームの `memo` とセッションの内容を `save_logs()` でDBに書き込み、セッションを空にして `/logs` にリダイレクト。
7. `GET /logs` → DB全体を取得し、同じセッション(`created_at`)ごとにまとめ、 `logs.html` に一覧表示する。
8. `POST /delete` → `created_at`を条件にDELETEして `/logs` にリダイレクト。 

### 既知の粗さ（学習用プロジェクトゆえの意図的なもの — 指摘はしても、指示なく勝手に直さないこと）

- `.env` に `SECRET_KEY` と `DB_PATH` が必要
- タスクテンプレートはハードコードされており、`app.py` と `task_condition_log.py` の間で重複している。
