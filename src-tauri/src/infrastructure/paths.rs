use std::ffi::OsString;
use std::fs;
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};

use crate::db::{DbError, DbResult};

#[derive(Debug, Clone)]
pub struct AppPaths {
    root: PathBuf,
}

impl AppPaths {
    pub fn from_app(app: &AppHandle) -> DbResult<Self> {
        if let Some(root) = override_app_data_dir()? {
            return Self::from_root(root);
        }

        let root = app.path().app_data_dir().map_err(|error| {
            DbError::new(
                "IO_ERROR",
                format!("failed to resolve app data directory: {error}"),
            )
        })?;
        Self::from_root(root)
    }

    pub fn from_root(root: PathBuf) -> DbResult<Self> {
        let paths = Self { root };
        paths.ensure_base_dirs()?;
        Ok(paths)
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn database(&self) -> PathBuf {
        self.root.join("mikavn.db")
    }

    pub fn images(&self) -> PathBuf {
        self.root.join("images")
    }

    pub fn cache(&self) -> PathBuf {
        self.root.join("cache")
    }

    pub fn logs(&self) -> PathBuf {
        self.root.join("logs")
    }

    pub fn save_backups(&self) -> PathBuf {
        self.root.join("save-backups")
    }

    pub fn archive_import_protection(&self) -> PathBuf {
        self.root.join("archive-import-protection")
    }

    pub fn database_restore_pending(&self) -> PathBuf {
        self.root.join("pending-restore")
    }

    pub fn database_restore_protection(&self) -> PathBuf {
        self.root.join("database-restore-protection")
    }

    pub fn ensure_base_dirs(&self) -> DbResult<()> {
        fs::create_dir_all(&self.root)?;
        fs::create_dir_all(self.images())?;
        fs::create_dir_all(self.cache())?;
        fs::create_dir_all(self.logs())?;
        fs::create_dir_all(self.save_backups())?;
        fs::create_dir_all(self.database_restore_pending())?;
        fs::create_dir_all(self.database_restore_protection())?;
        Ok(())
    }
}

fn override_app_data_dir() -> DbResult<Option<PathBuf>> {
    override_app_data_dir_from(std::env::var_os("MIKAVN_APP_DATA_DIR"))
}

fn override_app_data_dir_from(value: Option<OsString>) -> DbResult<Option<PathBuf>> {
    match value {
        Some(value) if !value.is_empty() => {
            let root = PathBuf::from(value);
            if root.is_relative() {
                return Err(DbError::validation(
                    "MIKAVN_APP_DATA_DIR must be an absolute path",
                ));
            }
            Ok(Some(root))
        }
        _ => Ok(None),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_paths_are_stable_under_root() {
        let root = PathBuf::from(r"C:\Users\tester\AppData\Roaming\MikaVN");
        let paths = AppPaths { root: root.clone() };

        assert_eq!(paths.database(), root.join("mikavn.db"));
        assert_eq!(paths.images(), root.join("images"));
        assert_eq!(paths.save_backups(), root.join("save-backups"));
    }

    #[test]
    fn override_app_data_dir_rejects_relative_paths() {
        let error = override_app_data_dir_from(Some(OsString::from("relative-path"))).unwrap_err();

        assert_eq!(error.code, "VALIDATION_ERROR");
    }

    #[test]
    fn override_app_data_dir_accepts_absolute_paths() {
        let root = if cfg!(windows) {
            PathBuf::from(r"C:\isolated\mikavn")
        } else {
            PathBuf::from("/tmp/isolated/mikavn")
        };

        let override_root =
            override_app_data_dir_from(Some(root.clone().into_os_string())).unwrap();

        assert_eq!(override_root, Some(root));
    }
}
