//! サーバーの起動。設定は環境変数（または .env）で渡す
//!
//! - SECRET_KEY（必須）: 進行中のタスクを入れる Cookie の暗号化に使う
//! - DB_PATH（必須）: SQLite のファイル
//! - ADDR: 待ち受けるアドレス（既定 127.0.0.1:8080。Docker では 0.0.0.0:8080）
//! - STATIC_DIR: ビルド済みフロントエンド（frontend/dist）の場所。未設定なら API だけを提供する

use std::env;
use std::path::PathBuf;
use std::process;

use tascon::{AppState, db, router, session};

fn require_env(name: &str) -> String {
    env::var(name).unwrap_or_else(|_| {
        eprintln!("環境変数 {name} を設定してください（.env.example を参照）");
        process::exit(1);
    })
}

#[tokio::main]
async fn main() {
    // .env があれば読む（親ディレクトリも探す）。Docker では環境変数で直接渡す
    let _ = dotenvy::dotenv();

    let secret = require_env("SECRET_KEY");
    let db_path = require_env("DB_PATH");
    let addr = env::var("ADDR").unwrap_or_else(|_| "127.0.0.1:8080".to_string());
    let static_dir = env::var("STATIC_DIR").ok().map(PathBuf::from);

    let conn = db::open(&db_path).unwrap_or_else(|e| {
        eprintln!("DB を開けませんでした（{db_path}）: {e}");
        process::exit(1);
    });
    match &static_dir {
        Some(dir) if !dir.join("index.html").exists() => {
            eprintln!(
                "警告: {}/index.html がありません。frontend で npm run build を実行してください",
                dir.display()
            );
        }
        None => println!(
            "STATIC_DIR が未設定なので API だけを提供します（画面は Vite の開発サーバーで開いてください）"
        ),
        _ => {}
    }

    let state = AppState::new(conn, session::key_from_secret(&secret));
    let app = router(state, static_dir.as_deref());

    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .unwrap_or_else(|e| {
            eprintln!("{addr} で待ち受けできませんでした: {e}");
            process::exit(1);
        });
    println!("tascon: http://{addr} で待ち受けています");
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .expect("サーバーが異常終了しました");
}

/// Ctrl+C か SIGTERM（docker stop）で終了する
async fn shutdown_signal() {
    let ctrl_c = async {
        let _ = tokio::signal::ctrl_c().await;
    };
    #[cfg(unix)]
    let terminate = async {
        if let Ok(mut sig) =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
        {
            sig.recv().await;
        }
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        () = ctrl_c => {},
        () = terminate => {},
    }
    println!("終了します");
}
