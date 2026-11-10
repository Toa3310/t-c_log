# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

tascon（仮称） は、その日の「調子（コンディション）」（集中度・気分：よくない／普通／いい）に応じて学習タスクを提案する、小規模な Flask 学習用プロジェクトです。タスクを単独で管理するのではなく、その日のコンディションと結びつける点が特徴です。現在は CLI 版プロトタイプから Flask を用いた Web アプリへ移行中です。コミットメッセージやテンプレート内の文言は日本語が基本なので、ドキュメントやコミットメッセージも日本語で書くこと。

## コマンド

- Web アプリの起動: `python app.py`（Flask 開発サーバー、debug モード、デフォルトで `http://localhost:5000`）
- 依存関係のインストール: `pip install -r requirements.txt`
- 初回セットアップ: `.env.example` を `.env` にコピーして `SECRET_KEY` と `DB_PATH` を設定
- CLI 版プロトタイプの実行: `python task_condition_log.py`

lint・ビルド・テストの仕組みは何も設定されていない（pytest なし、JS ツールチェーンなし、CI なし）。

## アーキテクチャ

- `app.py` — Flask アプリ本体。ルーティング、セッションベースの状態管理、DB 初期化（`init_db()`、テンプレートの初期データ投入を含む）、入力のバリデーション（`parse_condition()` / `parse_task_name()`）がすべてこの1ファイルに収まっている。Blueprint やビジネスロジック用の別モジュールには分割されていない。
- `templates/index.html`、`templates/start.html`、`templates/complete.html`、 `templates/base.html`、 `templates/cancel.html`、 `templates/logs.html`、 `templates/task_templates.html`、 `templates/stats.html` — Jinja2 テンプレート。CSSは `static/style.css` を導入、JSはなし。
- `task_condition_log.py` — スタンドアロンの CLI プロトタイプ（`input()` による対話型）。`app.py` のロジックはここから移植されたもの。`completion_rate` やタスクテンプレートのロジックが `app.py` と重複しており、`app.py` からこれを import してはいない。片方を修正する際はもう片方にも同じ修正が必要か確認すること。

### リクエストフロー（セッションを使ったステートマシン）

作業中の状態（`selected_tasks`）はセッション、確定した記録（`task_logs`）とタスクテンプレート（`task_templates`）はSQLiteに保存する。JS/localStorageは使わない

1. `GET /` → `index.html` — コンディション（0/1/2）選択ボタンを表示。
2. `POST /tasks` → `make_tasks(condition)` が DB の `task_templates` からコンディションごとのタスク（`id`・`name`）を返し、`index.html` をチェックボックス付きで再描画（コンディションは hidden input で引き継ぐ）。チェックボックスの値はテンプレートの `id`。
3. `POST /start` → 選択された `id` を DB のテンプレートと照合して名前に変換し（存在しない `id` は無視）、1つ以上選択されているかサーバー側でバリデーション（HTML の `required` だけではチェックボックスグループの最小選択数を強制できないため）。`session["selected_tasks"]` に保存し、進捗率とともに `start.html` を描画。
4. `POST /complete` → `task_index`（`selected_tasks` 内の位置）で該当タスクを完了状態にし（同名タスクが複数あっても1つだけ完了にするため、名前では照合しない）、進捗率を再計算。すべて完了していれば `complete.html` を、そうでなければ更新後の `start.html` を描画する。同じルートでも状態によって返すテンプレートが分岐する点に注意。
5. `POST /cancel` → セッションの `selected_tasks` を読み、進捗率とともにcancel.html(途中終了画面)を表示。ここではまだDBに保存しない。
6. `POST /save` → フォームの `memo` とセッションの内容を `save_logs()` でDBに書き込み、セッションを空にして `/logs` にリダイレクト。
7. `GET /logs` → DB全体を取得し、同じセッション(`created_at`)ごとにまとめ、 `logs.html` に一覧表示する。
8. `POST /logs/delete` → `created_at`を条件にDELETEして `/logs` にリダイレクト。
9. `GET /templates` → `task_templates.html` でテンプレートを調子ごとに一覧表示。`POST /templates/add`・`/templates/edit`・`/templates/delete` で追加・名前変更・削除し、`/templates` にリダイレクト。
10. `GET /stats` → 全体・調子ごとの達成率（全期間）と、直近 `STATS_RECENT_DAYS` 日の調子の割合（円グラフ、CSS の `conic-gradient`）を `stats.html` に表示。記録がない場合は `None` を渡し、テンプレート側で「データなし」と表示する。

セッションに `selected_tasks` がない状態で `/complete`・`/cancel` に来た場合（保存後にブラウザで戻った等）や、`condition` が不正な場合は `/` にリダイレクトする。

### 既知の粗さ（学習用プロジェクトゆえの意図的なもの — 指摘はしても、指示なく勝手に直さないこと）

- `.env` に `SECRET_KEY` と `DB_PATH` が必要
- タスクテンプレートの初期データは `app.py` の `init_db()` と `task_condition_log.py` にそれぞれハードコードされて重複しており、内容も一部異なる（CLI 版は「昨日の復習10分」「参考書4セクション」など）。
