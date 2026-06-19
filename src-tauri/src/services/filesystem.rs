use std::path::PathBuf;

use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

use crate::db::{DbError, DbResult};

pub fn reveal_path(app: &AppHandle, path: String) -> DbResult<()> {
    match resolve_reveal_target(&path)? {
        RevealTarget::File(path) => app
            .opener()
            .reveal_item_in_dir(&path)
            .map_err(|error| DbError::new("IO_ERROR", format!("failed to reveal path: {error}"))),
        RevealTarget::Directory(path) => app
            .opener()
            .open_path(path.to_string_lossy().to_string(), None::<String>)
            .map_err(|error| DbError::new("IO_ERROR", format!("failed to open path: {error}"))),
    }
}

#[derive(Debug, PartialEq, Eq)]
enum RevealTarget {
    File(PathBuf),
    Directory(PathBuf),
}

fn resolve_reveal_target(path: &str) -> DbResult<RevealTarget> {
    let path = PathBuf::from(path.trim());
    if path.as_os_str().is_empty() {
        return Err(DbError::validation("path is required"));
    }
    if !path.exists() {
        return Err(DbError::path_not_found("path does not exist"));
    }

    if path.is_file() {
        Ok(RevealTarget::File(path))
    } else {
        Ok(RevealTarget::Directory(path))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use uuid::Uuid;

    #[test]
    fn empty_reveal_path_is_rejected() {
        let error = resolve_reveal_target("   ").unwrap_err();
        assert_eq!(error.code, "VALIDATION_ERROR");
    }

    #[test]
    fn existing_directory_opens_path_directly() {
        let root = std::env::temp_dir().join(format!("mikavn-reveal-dir-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();

        assert_eq!(
            resolve_reveal_target(&format!("  {}  ", root.to_string_lossy())).unwrap(),
            RevealTarget::Directory(root.clone())
        );

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn existing_file_is_revealed_in_parent_directory() {
        let root = std::env::temp_dir().join(format!("mikavn-reveal-file-{}", Uuid::new_v4()));
        let file = root.join("mikavn.db");
        fs::create_dir_all(&root).unwrap();
        fs::write(&file, b"sqlite placeholder").unwrap();

        assert_eq!(
            resolve_reveal_target(&file.to_string_lossy()).unwrap(),
            RevealTarget::File(file.clone())
        );

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn missing_reveal_path_is_rejected() {
        let missing = std::env::temp_dir()
            .join(format!("mikavn-reveal-missing-{}", Uuid::new_v4()))
            .join("missing");

        let error = resolve_reveal_target(&missing.to_string_lossy()).unwrap_err();
        assert_eq!(error.code, "PATH_NOT_FOUND");
    }
}
