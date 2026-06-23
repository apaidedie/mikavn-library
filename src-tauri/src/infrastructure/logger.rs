use std::fs::OpenOptions;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use chrono::Utc;
use regex::{Captures, Regex};

use crate::db::DbResult;
use crate::infrastructure::paths::AppPaths;

const REDACTED: &str = "[redacted]";

pub fn redact_sensitive_text(value: &str) -> String {
    let mut redacted = redact_key_values(value);
    redacted = redact_windows_user_paths(&redacted);
    redacted
}

pub fn display_path(path: &Path) -> String {
    redact_sensitive_text(&path.to_string_lossy())
}

pub fn log_info(paths: &AppPaths, scope: &str, message: impl AsRef<str>) {
    let _ = append_line(paths, "INFO", scope, message.as_ref());
}

pub fn log_warn(paths: &AppPaths, scope: &str, message: impl AsRef<str>) {
    let _ = append_line(paths, "WARN", scope, message.as_ref());
}

pub fn log_error(paths: &AppPaths, scope: &str, message: impl AsRef<str>) {
    let _ = append_line(paths, "ERROR", scope, message.as_ref());
}

fn append_line(paths: &AppPaths, level: &str, scope: &str, message: &str) -> DbResult<PathBuf> {
    let now = Utc::now();
    let log_path = paths
        .logs()
        .join(format!("mikavn-{}.log", now.format("%Y%m%d")));
    let clean_scope = redact_sensitive_text(scope).replace(['\r', '\n'], " ");
    let clean_message = redact_sensitive_text(message).replace(['\r', '\n'], " ");
    let line = format!(
        "{} [{level}] {clean_scope}: {clean_message}\n",
        now.to_rfc3339()
    );

    OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)?
        .write_all(line.as_bytes())?;
    Ok(log_path)
}

fn redact_key_values(value: &str) -> String {
    let without_json_authorization =
        authorization_json_secret_regex().replace_all(value, |captures: &Captures| {
            format!(
                "{}{}{}{}{}{}{}",
                &captures[1],
                &captures[2],
                &captures[3],
                &captures[4],
                &captures[5],
                REDACTED,
                &captures[6]
            )
        });
    let without_json_secrets = secret_json_field_regex().replace_all(
        &without_json_authorization,
        |captures: &Captures| {
            format!(
                "{}{}{}{}{}{}{}",
                &captures[1],
                &captures[2],
                &captures[3],
                &captures[4],
                &captures[5],
                REDACTED,
                &captures[6]
            )
        },
    );
    let without_authorization = authorization_secret_regex()
        .replace_all(&without_json_secrets, |captures: &Captures| {
            format!("{}{}{}", &captures[1], &captures[2], REDACTED)
        });
    let without_key_values = secret_key_value_regex()
        .replace_all(&without_authorization, |captures: &Captures| {
            format!("{}{}{}", &captures[1], &captures[2], REDACTED)
        });
    raw_token_regex()
        .replace_all(&without_key_values, REDACTED)
        .into_owned()
}

fn authorization_json_secret_regex() -> &'static Regex {
    static AUTHORIZATION_JSON_SECRET_REGEX: OnceLock<Regex> = OnceLock::new();
    AUTHORIZATION_JSON_SECRET_REGEX.get_or_init(|| {
        Regex::new(
            r#"(?i)(["'])(authorization)(["'])(\s*:\s*)(["'])(?:Bearer\s+)?[^"'\r\n]*(["'])"#,
        )
        .expect("valid JSON authorization redaction regex")
    })
}

fn secret_json_field_regex() -> &'static Regex {
    static SECRET_JSON_FIELD_REGEX: OnceLock<Regex> = OnceLock::new();
    SECRET_JSON_FIELD_REGEX.get_or_init(|| {
        Regex::new(r#"(?i)(["'])(api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|auth[_-]?token|id[_-]?token|private[_-]?key|signing[_-]?key|session(?:[_-]?id)?|cookie|jwt|secret|token|password)(["'])(\s*:\s*)(["'])[^"'\r\n]*(["'])"#)
            .expect("valid JSON secret field redaction regex")
    })
}

fn authorization_secret_regex() -> &'static Regex {
    static AUTHORIZATION_SECRET_REGEX: OnceLock<Regex> = OnceLock::new();
    AUTHORIZATION_SECRET_REGEX.get_or_init(|| {
        Regex::new(r"(?i)\b(authorization)\b(\s*[:=]\s*)(?:Bearer\s+)?[^\s,;]+")
            .expect("valid authorization redaction regex")
    })
}

fn secret_key_value_regex() -> &'static Regex {
    static SECRET_KEY_VALUE_REGEX: OnceLock<Regex> = OnceLock::new();
    SECRET_KEY_VALUE_REGEX.get_or_init(|| {
        Regex::new(r"(?i)\b(api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|auth[_-]?token|id[_-]?token|private[_-]?key|signing[_-]?key|session(?:[_-]?id)?|cookie|jwt|secret|token|password)\b(\s*[:=]\s*)[^\s,;]+")
            .expect("valid secret key-value redaction regex")
    })
}

fn raw_token_regex() -> &'static Regex {
    static RAW_TOKEN_REGEX: OnceLock<Regex> = OnceLock::new();
    RAW_TOKEN_REGEX.get_or_init(|| {
        Regex::new(
            r"\b(?:sk-[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{30,})\b",
        )
        .expect("valid raw token redaction regex")
    })
}

fn redact_windows_user_paths(value: &str) -> String {
    windows_user_path_regex()
        .replace_all(value, |captures: &Captures| {
            format!("C:{}Users{}[user]", &captures[1], &captures[2])
        })
        .into_owned()
}

fn windows_user_path_regex() -> &'static Regex {
    static WINDOWS_USER_PATH_REGEX: OnceLock<Regex> = OnceLock::new();
    WINDOWS_USER_PATH_REGEX.get_or_init(|| {
        Regex::new(r"(?i)\bc:([\\/])users([\\/])[^\\/]+")
            .expect("valid Windows user path redaction regex")
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redacts_tokens_and_user_profile_paths() {
        let text = r"API_KEY=secret C:\Users\alice\AppData\Roaming\MikaVN\mikavn.db token:abc";
        let redacted = redact_sensitive_text(text);

        assert!(!redacted.contains("secret"));
        assert!(!redacted.contains("alice"));
        assert!(redacted.contains("API_KEY=[redacted]"));
        assert!(redacted.contains(r"C:\Users\[user]\AppData"));
    }

    #[test]
    fn redacts_forward_slash_windows_user_profile_paths() {
        let text = "cache path C:/Users/alice/AppData/Roaming/MikaVN/logs/mikavn.log";
        let redacted = redact_sensitive_text(text);

        assert!(!redacted.contains("alice"));
        assert!(redacted.contains("C:/Users/[user]/AppData"));
    }

    #[test]
    fn redacts_common_session_cookie_signing_and_bearer_secrets() {
        let text = r"cookie=session-cookie session_id=session-id jwt=jwt-secret private_key=private-key secret=plain-secret Authorization: Bearer bearer-secret";
        let redacted = redact_sensitive_text(text);

        assert!(redacted.contains("[redacted]"));
        assert!(!redacted.contains("session-cookie"));
        assert!(!redacted.contains("session-id"));
        assert!(!redacted.contains("jwt-secret"));
        assert!(!redacted.contains("private-key"));
        assert!(!redacted.contains("plain-secret"));
        assert!(!redacted.contains("bearer-secret"));
    }

    #[test]
    fn redacts_json_style_secret_fields() {
        let text = r#"{"api_key":"json-api-secret","session_id":"json-session-secret","private_key":"json-private-secret","authorization":"Bearer json-bearer-secret"}"#;
        let redacted = redact_sensitive_text(text);

        assert!(redacted.contains("[redacted]"));
        assert!(!redacted.contains("json-api-secret"));
        assert!(!redacted.contains("json-session-secret"));
        assert!(!redacted.contains("json-private-secret"));
        assert!(!redacted.contains("json-bearer-secret"));
    }

    #[test]
    fn redacts_common_raw_token_prefixes() {
        let text = "Provider returned sk-testRawTokenValue1234567890 and ghp_abcdefghijklmnopqrstuvwxyz123456 plus github_pat_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let redacted = redact_sensitive_text(text);

        assert!(redacted.contains("[redacted]"));
        assert!(!redacted.contains("sk-testRawTokenValue1234567890"));
        assert!(!redacted.contains("ghp_abcdefghijklmnopqrstuvwxyz123456"));
        assert!(!redacted
            .contains("github_pat_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"));
    }

    #[test]
    fn writes_redacted_local_log_file() {
        let root = std::env::temp_dir().join(format!("mikavn-log-test-{}", uuid::Uuid::new_v4()));
        let paths = AppPaths::from_root(root.clone()).unwrap();

        log_error(
            &paths,
            "test",
            r"API_KEY=secret C:\Users\alice\AppData\Roaming\MikaVN\mikavn.db",
        );

        let entries = std::fs::read_dir(paths.logs())
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();
        assert_eq!(entries.len(), 1);
        let content = std::fs::read_to_string(entries[0].path()).unwrap();
        assert!(content.contains("[ERROR] test"));
        assert!(content.contains("API_KEY=[redacted]"));
        assert!(!content.contains("secret"));
        assert!(!content.contains("alice"));

        let _ = std::fs::remove_dir_all(root);
    }
}
