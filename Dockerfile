# tascon を1つのコンテナで動かすためのイメージ
#   1. フロントエンド（Vite）をビルド → 静的ファイル
#   2. バックエンド（Rust）をビルド → 実行ファイル1つ
#   3. 両方を小さな Debian イメージに入れる（Node.js や Rust のツールは入らない）

# ---- 1. フロントエンド ----
# EVC など他のプロジェクトと同じ node:22-slim を使う（イメージを共有でき、ディスクを節約できる）
FROM node:22-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY frontend/ ./
RUN npm run build

# ---- 2. バックエンド ----
FROM rust:1.99-slim-trixie AS backend
WORKDIR /app/backend
COPY backend/Cargo.toml backend/Cargo.lock ./
COPY backend/src ./src
# ダウンロードしたクレートはキャッシュして再利用する。
# ビルド結果（target、数百 MB）はディスクに残さないよう、同じ RUN の中で消す
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    cargo build --release --locked \
    && cp target/release/tascon /usr/local/bin/tascon \
    && rm -rf target

# ---- 3. 実行用 ----
FROM debian:trixie-slim
# tzdata: TZ=Asia/Tokyo で「今日」の日付を日本時間にするため
RUN apt-get update \
    && apt-get install -y --no-install-recommends tzdata \
    && rm -rf /var/lib/apt/lists/*
# root ではなく専用ユーザーで動かす。DB は /data（ボリューム）に置く
RUN useradd --system --uid 10001 --no-create-home tascon \
    && mkdir -p /data \
    && chown tascon /data
COPY --from=backend /usr/local/bin/tascon /usr/local/bin/tascon
COPY --from=frontend /app/frontend/dist /app/static
ENV ADDR=0.0.0.0:8080 \
    STATIC_DIR=/app/static \
    DB_PATH=/data/tascon.db \
    TZ=Asia/Tokyo
USER tascon
VOLUME /data
EXPOSE 8080
CMD ["tascon"]
