# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

tascon（仮称） は、その日の「調子（コンディション）」（集中度・気分：よくない／普通／良い）に応じて学習タスクを提案する、小規模な学習用プロジェクトです。タスクを単独で管理するのではなく、その日のコンディションと結びつける点が特徴です。バックエンドは Rust（axum）の JSON API、フロントエンドは Vite + React + TypeScript で、Docker でまとめて動かせます（以前は Flask だったが、機能はそのままに置き換えた）。コミットメッセージや画面の文言は日本語が基本なので、ドキュメントやコミットメッセージ、コード中のコメントも日本語で書くこと。

## コマンド

初回: `.env.example` を `.env` にコピーして値を設定する（`SECRET_KEY` は必須）。

- Docker で起動: `docker compose up -d --build` → `http://localhost:8080`（公開するアドレスとポートは `.env` の `TASCON_BIND`・`TASCON_PORT`）
- バックエンド（`backend/`）
  - 起動: `cargo run`（`.env` の `ADDR`、既定 `127.0.0.1:8080` で API だけを提供）
  - テスト: `cargo test`（`src/domain.rs` の単体テストと `tests/api.rs` の API テスト。メモリ上の SQLite を使う）
  - 1つだけ: `cargo test --test api full_flow_with_duplicate_names`
- フロントエンド（`frontend/`）
  - 初回: `npm install`
  - 開発サーバー: `npm run dev`（`/api` は `.env` の `ADDR` に転送される）
  - 型チェック＋ビルド: `npm run build`（`tsc -b` のあと `vite build`、出力は `frontend/dist`）
  - lint: `npm run lint`（oxlint）
- CLI 版プロトタイプ: `python task_condition_log.py`

Astryx のコンポーネント API を調べるときは `npx @astryxdesign/cli component <Name>`（例: `Button`）、一覧は `npx @astryxdesign/cli component --list`。型は `frontend/node_modules/@astryxdesign/core/dist/*/*.d.ts` にもある。

CI は無い。

## アーキテクチャ

```
backend/   Rust（axum）。JSON API（/api/...）と、frontend/dist の配信
frontend/  Vite + React 19 + TypeScript。UI は Meta のデザインシステム Astryx
Dockerfile, compose.yaml  フロント→バックの順にビルドし、実行ファイル1つ＋静的ファイルの小さなイメージにする
task_condition_log.py     CLI 版プロトタイプ（Python、標準ライブラリのみ）
```

### バックエンド（`backend/src`）

- `main.rs` — 環境変数（`SECRET_KEY`・`DB_PATH`・`ADDR`・`STATIC_DIR`）を読み、DB を開いてサーバーを起動する。`.env` は `dotenvy` で親ディレクトリまで探す。SIGTERM（`docker stop`）で正しく終了する。
- `lib.rs` — `AppState`（SQLite の接続1本を `Mutex` で共有、Cookie 暗号化の鍵）と `router()`。`STATIC_DIR` があれば API 以外のパスは静的ファイル、無ければ `index.html` を返す（React Router のため）。テストからも `router()` を使う。
- `domain.rs` — 調子のラベル・並び順、入力の検証（`parse_condition`・`parse_task_name`・`normalize_memo`）、`completion_rate`、上限値（タスク名50文字、メモ200文字、1回に選べるタスク10件、統計の直近30日）。HTTP や DB に依存しない。
- `db.rs` — SQLite（`rusqlite`、`bundled` なので OS の libsqlite3 は不要）。テーブル構成は Flask 版と同じ（`task_logs`・`task_templates`）なので、以前の DB ファイルをそのまま使える。`init()` がテーブル作成・`memo` 列の移行・初期テンプレートの投入を行う。
- `session.rs` — 進行中のタスク（`ActiveSession`）を **暗号化 Cookie**（`PrivateCookieJar`、鍵は `SECRET_KEY` の SHA-512）に入れる。記録するまで DB には書かない（Flask 版のセッションと同じ考え方）。Cookie のサイズ上限（約4KB）のため、選べるタスクを10件までにしている。
- `error.rs` — `ApiError`。どのエラーも `{"error": "日本語のメッセージ"}` の JSON で返す（400 入力エラー／404／409 状態が合わない／500）。
- `routes/` — ハンドラー。`ApiJson`・`ApiPath` は axum の `Json`・`Path` と同じだが、失敗時に `ApiError` を返す。JSON のキーは `camelCase`。

### API

| メソッドとパス | 内容 |
| --- | --- |
| `GET /api/templates` | 調子ごとのテンプレート（良い→普通→よくない の順）と `nameMaxLength` |
| `POST /api/templates` | `{condition, name}` で追加 |
| `PATCH /api/templates/{id}` | `{name}` で名前を変更 |
| `DELETE /api/templates/{id}` | 削除（記録は消えない） |
| `GET /api/session` | 進行中のタスク（無ければ `{"session": null}`） |
| `POST /api/session` | `{condition, templateIds}` で始める。その調子に実在する id だけを使い、並びはテンプレート順 |
| `POST /api/session/tasks/{index}/complete` | index 番目を完了にする（同名タスクがあっても1つだけ完了になるよう、名前ではなく位置で指定） |
| `POST /api/session/save` | `{memo}` で記録を保存し、進行中の状態を消す |
| `GET /api/logs` | 記録を1回分（同じ `created_at`）ずつまとめて、新しい順に返す |
| `DELETE /api/logs/{created_at}` | 1回分の記録を削除（`created_at` は URL エンコードして渡す） |
| `GET /api/stats` | 全体・調子ごとの達成率（全期間）、直近30日の調子の割合。記録が無いものは `null` |

### フロントエンド（`frontend/src`）

- `main.tsx` — Astryx の CSS（reset → astryx → theme の順に意味がある）とフォント（`@fontsource/figtree`。日本語は OS のフォント）を読み込む。
- `App.tsx` — ルーティング（React Router）。`/`（調子とタスクを選ぶ）→ `/session`（1つずつ完了）→ `/session/finish`（メモを付けて記録。全部完了か途中で終えたかで文言が変わる）、`/logs`、`/stats`、`/templates`。Astryx の日本語化（`InternationalizationProvider`）とテーマもここ。
- `api.ts` — API の型と呼び出し関数。エラーはサーバーの日本語メッセージを持つ `ApiError` になる。
- `hooks/useApi.ts` — ページ表示時の読み込み（loading / error / ready）。
- `components/Layout.tsx` — AppShell＋上部ナビ（スマホではメニューに折りたたまれる）。`LinkProvider` に `RouterLink` を渡し、Astryx の `href` をページ再読み込みなしの遷移にしている。
- `conditions.ts` — 調子ごとの色（`CONDITION_STYLES`）と日時・割合の表示。色は「よくない < 普通 < 良い」の順序がある尺度として、オレンジ・グレー・青（Astryx のデータ可視化トークン）にしている。赤緑の組み合わせは色覚多様性の点で避けた。
- `index.css` — Astryx にない部分（統計のセグメントバー、色見本など）だけ。色は Astryx のトークン（`var(--color-…)`）を使い、ダークモードに追従させる。
- 選んだ調子は URL（`/?condition=1`）に持たせている。状態を localStorage などには持たない（進行中のタスクはサーバーの Cookie、記録とテンプレートは DB）。

### Docker

- `Dockerfile` は3段階: `node:22-slim` で `npm ci && npm run build` → `rust:1.99-slim-trixie` で `cargo build --release` → `debian:trixie-slim` に実行ファイルと `dist` だけを入れる。実行ユーザーは root ではなく `tascon`（uid 10001）。`TZ=Asia/Tokyo`（`tzdata` を入れている）で「今日」を日本時間にする。
- DB はボリューム `tascon-data` の `/data/tascon.db`。
- 公開するアドレスは `.env` の `TASCON_BIND`（既定 `127.0.0.1`＝この PC だけ）。Tailscale の IP にすると tailnet の端末からだけ開ける。ログイン機能が無いので `0.0.0.0` にはしないこと。
- 開発に使っている VM はディスクが小さいので、Rust のビルド結果（`target`）は Docker のキャッシュに残さない設定にしている。

### バージョン

- Astryx は `0.7.4` に固定（`@astryxdesign/core` と `@astryxdesign/theme-neutral` はそろえる）。ベータ版で更新が速いので、上げるときは画面を確認すること。
- Rust の依存は `Cargo.lock`、npm の依存は `package-lock.json` で固定している。

## 既知の粗さ（学習用プロジェクトゆえの意図的なもの — 指摘はしても、指示なく勝手に直さないこと）

- `.env`（または環境変数）に `SECRET_KEY` と `DB_PATH` が必要（Docker では `DB_PATH` はイメージ側で設定済み）。
- タスクテンプレートの初期データは `backend/src/db.rs` の `INITIAL_TEMPLATES` と `task_condition_log.py` にそれぞれハードコードされて重複しており、内容も一部異なる（CLI 版は「昨日の復習10分」「参考書4セクション」など）。`completion_rate` も両方にある。片方を直すときはもう片方も確認すること。
- ログイン機能が無いので、記録やテンプレートは全員で共有になる。
