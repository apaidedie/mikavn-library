use std::path::PathBuf;

use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

use crate::db::{DbError, DbResult};

pub fn reveal_path(app: &AppHandle, path: String) -> DbResult<()> {
    let path = PathBuf::from(path.trim());
    if path.as_os_str().is_empty() {
        return Err(DbError::validation("path is required"));
    }
    if !path.exists() {
        return Err(DbError::path_not_found("path does not exist"));
    }

    if path.is_file() {
        app.opener()
            .reveal_item_in_dir(&path)
            .map_err(|error| DbError::new("IO_ERROR", format!("failed to reveal path: {error}")))
    } else {
        app.opener()
            .open_path(path.to_string_lossy().to_string(), None::<String>)
            .map_err(|error| DbError::new("IO_ERROR", format!("failed to open path: {error}")))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_reveal_path_is_rejected() {
        let error = validate_reveal_path("   ").unwrap_err();
        assert_eq!(error.code, "VALIDATION_ERROR");
    }

    fn validate_reveal_path(path: &str) -> DbResult<PathBuf> {
        let path = PathBuf::from(path.trim());
        if path.as_os_str().is_empty() {
            return Err(DbError::validation("path is required"));
        }
        if !path.exists() {
            return Err(DbError::path_not_found("path does not exist"));
        }
        Ok(path)
    }
}
