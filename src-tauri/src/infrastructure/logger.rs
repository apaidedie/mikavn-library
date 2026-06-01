use std::fs::OpenOptions;
use std::io::Write;
use std::path::{Path, PathBuf};

use chrono::Utc;

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
    value
        .split_whitespace()
        .map(|part| {
            let lower = part.to_ascii_lowercase();
            if lower.contains("api_key")
                || lower.contains("apikey")
                || lower.contains("token")
                || lower.contains("authorization")
                || lower.contains("password")
            {
                if let Some((key, _)) = part.split_once('=') {
                    format!("{key}={REDACTED}")
                } else if let Some((key, _)) = part.split_once(':') {
                    format!("{key}:{REDACTED}")
                } else {
                    REDACTED.to_string()
                }
            } else {
                part.to_string()
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn redact_windows_user_paths(value: &str) -> String {
    let mut output = String::with_capacity(value.len());
    let mut index = 0;
    while let Some(relative) = value[index..].to_ascii_lowercase().find(r"c:\users\") {
        let start = index + relative;
        output.push_str(&value[index..start]);
        let after_prefix = start + r"C:\Users\".len();
        let rest = &value[after_prefix..];
        let end_offset = rest.find(['\\', '/']).unwrap_or(rest.len());
        output.push_str(r"C:\Users\[user]");
        index = after_prefix + end_offset;
    }
    output.push_str(&value[index..]);
    output
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
