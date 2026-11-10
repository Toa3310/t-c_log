//! 進行中のタスク（まだ記録していない状態）。
//! Flask 版のセッションと同じく、サーバーには保存せず Cookie に入れる。
//! Cookie は SECRET_KEY から作った鍵で暗号化するので、ブラウザ側で中身を読んだり書き換えたりできない。

use axum_extra::extract::cookie::{Cookie, Key, PrivateCookieJar, SameSite};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha512};

const COOKIE_NAME: &str = "tascon_session";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActiveSession {
    pub condition: i64,
    pub tasks: Vec<SessionTask>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionTask {
    pub name: String,
    pub done: bool,
}

impl ActiveSession {
    pub fn is_complete(&self) -> bool {
        self.tasks.iter().all(|t| t.done)
    }
}

/// SECRET_KEY（任意の長さの文字列）から Cookie 暗号化用の 64 バイトの鍵を作る
pub fn key_from_secret(secret: &str) -> Key {
    Key::from(Sha512::digest(secret.as_bytes()).as_slice())
}

pub fn load(jar: &PrivateCookieJar) -> Option<ActiveSession> {
    jar.get(COOKIE_NAME)
        .and_then(|c| serde_json::from_str(c.value()).ok())
}

pub fn store(jar: PrivateCookieJar, session: &ActiveSession) -> PrivateCookieJar {
    let value = serde_json::to_string(session).expect("ActiveSession は必ず JSON にできる");
    let cookie = Cookie::build((COOKIE_NAME, value))
        .path("/")
        .http_only(true)
        .same_site(SameSite::Lax)
        .build();
    jar.add(cookie)
}

pub fn clear(jar: PrivateCookieJar) -> PrivateCookieJar {
    jar.remove(Cookie::build(COOKIE_NAME).path("/"))
}
