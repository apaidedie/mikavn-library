use std::ffi::OsString;
use std::fs;
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};

use crate::db::{DbError, DbResult};

const APP_DATA_ENV_VAR: &str = "MIKAVN_APP_DATA_DIR";
const PORTABLE_APP_DATA_DIR: &str = "app-data";
const PORTABLE_MARKER_FILE: &str = ".mikavn-portable";
const PORTABLE_MARKER_CONTENT: &str = "MikaVN Library portable app data\n";
const INSTALLER_UNINSTALLER_FILE: &str = "uninstall.exe";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AppDataDirSource {
    Environment,
    Portable,
    Default,
}

impl AppDataDirSource {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Environment => "env",
            Self::Portable => "portable",
            Self::Default => "default",
        }
    }
}

#[derive(Debug, Clone)]
pub struct AppDataDirResolution {
    pub root: PathBuf,
    pub source: AppDataDirSource,
    default_root: PathBuf,
}

#[derive(Debug, Clone)]
pub struct AppPaths {
    root: PathBuf,
}

impl AppPaths {
    pub fn from_app(app: &AppHandle) -> DbResult<Self> {
        Self::from_resolution(Self::resolve_from_app(app)?)
    }

    fn from_resolution(resolution: AppDataDirResolution) -> DbResult<Self> {
        let paths = Self::from_root(resolution.root)?;
        if resolution.source == AppDataDirSource::Portable {
            migrate_default_app_data_to_portable(&paths, &resolution.default_root)?;
            paths.ensure_portable_marker()?;
        }
        Ok(paths)
    }

    pub fn resolve_from_app(app: &AppHandle) -> DbResult<AppDataDirResolution> {
        let default_root = app.path().app_data_dir().map_err(|error| {
            DbError::new(
                "IO_ERROR",
                format!("failed to resolve app data directory: {error}"),
            )
        })?;
        resolve_app_data_dir(default_root)
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

    pub fn database_backups(&self) -> PathBuf {
        self.root.join("database-backups")
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
        fs::create_dir_all(self.database_backups())?;
        fs::create_dir_all(self.database_restore_pending())?;
        fs::create_dir_all(self.database_restore_protection())?;
        Ok(())
    }

    fn ensure_portable_marker(&self) -> DbResult<()> {
        let marker = self.root.join(PORTABLE_MARKER_FILE);
        if !marker.exists() {
            fs::write(marker, PORTABLE_MARKER_CONTENT)?;
        }
        Ok(())
    }
}

fn resolve_app_data_dir(default_root: PathBuf) -> DbResult<AppDataDirResolution> {
    resolve_app_data_dir_from(
        default_root,
        std::env::var_os(APP_DATA_ENV_VAR),
        std::env::current_exe().ok().as_deref(),
    )
}

fn resolve_app_data_dir_from(
    default_root: PathBuf,
    env_value: Option<OsString>,
    current_exe: Option<&Path>,
) -> DbResult<AppDataDirResolution> {
    if let Some(root) = override_app_data_dir_from(env_value)? {
        return Ok(AppDataDirResolution {
            root,
            source: AppDataDirSource::Environment,
            default_root: default_root.clone(),
        });
    }

    if let Some(root) = current_exe.and_then(portable_app_data_dir_from_exe) {
        return Ok(AppDataDirResolution {
            root,
            source: AppDataDirSource::Portable,
            default_root: default_root.clone(),
        });
    }

    Ok(AppDataDirResolution {
        root: default_root.clone(),
        source: AppDataDirSource::Default,
        default_root,
    })
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

fn portable_app_data_dir_from_exe(exe_path: &Path) -> Option<PathBuf> {
    let install_dir = exe_path.parent()?;
    let app_data = install_dir.join(PORTABLE_APP_DATA_DIR);
    if app_data.join("mikavn.db").is_file()
        || app_data.join(PORTABLE_MARKER_FILE).is_file()
        || is_user_writable_installed_app_dir(install_dir)
    {
        Some(app_data)
    } else {
        None
    }
}

fn is_user_writable_installed_app_dir(install_dir: &Path) -> bool {
    install_dir.join(INSTALLER_UNINSTALLER_FILE).is_file()
        && !is_protected_windows_install_dir(install_dir)
}

fn is_protected_windows_install_dir(path: &Path) -> bool {
    let lower = path
        .to_string_lossy()
        .replace('/', "\\")
        .trim_end_matches('\\')
        .to_ascii_lowercase();
    lower == "c:\\program files"
        || lower.starts_with("c:\\program files\\")
        || lower == "c:\\program files (x86)"
        || lower.starts_with("c:\\program files (x86)\\")
        || lower == "c:\\windows"
        || lower.starts_with("c:\\windows\\")
}

fn migrate_default_app_data_to_portable(paths: &AppPaths, default_root: &Path) -> DbResult<()> {
    let default_database = default_root.join("mikavn.db");
    if paths.database().is_file() || !default_database.is_file() {
        return Ok(());
    }

    let source_root = default_root.canonicalize()?;
    let target_root = paths.root().canonicalize()?;
    if source_root == target_root || target_root.starts_with(&source_root) {
        return Ok(());
    }

    let target_database = target_root.join("mikavn.db");
    if !target_database.exists() {
        fs::copy(source_root.join("mikavn.db"), &target_database)?;
    }
    paths.ensure_portable_marker()?;
    copy_directory_contents_without_overwrite(&source_root, &target_root, &["mikavn.db"])
}

fn copy_directory_contents_without_overwrite(
    source: &Path,
    target: &Path,
    skipped_file_names: &[&str],
) -> DbResult<()> {
    fs::create_dir_all(target)?;
    let Ok(entries) = fs::read_dir(source) else {
        return Ok(());
    };
    for entry in entries.flatten() {
        let source_path = entry.path();
        let Some(file_name) = source_path.file_name() else {
            continue;
        };
        if file_name
            .to_str()
            .is_some_and(|name| skipped_file_names.contains(&name))
        {
            continue;
        }

        let target_path = target.join(file_name);
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if file_type.is_dir() {
            if copy_directory_contents_without_overwrite(&source_path, &target_path, &[]).is_err() {
                continue;
            }
        } else if file_type.is_file()
            && !target_path.exists()
            && fs::copy(&source_path, &target_path).is_err()
        {
            continue;
        }
    }
    Ok(())
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
        assert_eq!(paths.database_backups(), root.join("database-backups"));
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

    #[test]
    fn resolves_env_override_before_portable_data() {
        let root = std::env::temp_dir().join(format!("mikavn-paths-env-{}", std::process::id()));
        let default_root = root.join("default");
        let portable_root = root.join("install").join("app-data");
        let env_root = root.join("env");
        fs::create_dir_all(&portable_root).unwrap();
        fs::write(portable_root.join("mikavn.db"), b"db").unwrap();
        let exe = root.join("install").join("mikavn-library.exe");

        let resolved = resolve_app_data_dir_from(
            default_root,
            Some(env_root.clone().into_os_string()),
            Some(&exe),
        )
        .unwrap();

        assert_eq!(resolved.root, env_root);
        assert_eq!(resolved.source, AppDataDirSource::Environment);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn resolves_portable_app_data_next_to_exe_when_database_exists() {
        let root =
            std::env::temp_dir().join(format!("mikavn-paths-portable-{}", std::process::id()));
        let default_root = root.join("default");
        let portable_root = root.join("install").join("app-data");
        fs::create_dir_all(&portable_root).unwrap();
        fs::write(portable_root.join("mikavn.db"), b"db").unwrap();
        let exe = root.join("install").join("mikavn-library.exe");

        let resolved = resolve_app_data_dir_from(default_root, None, Some(&exe)).unwrap();

        assert_eq!(resolved.root, portable_root);
        assert_eq!(resolved.source, AppDataDirSource::Portable);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn resolves_installed_user_directory_to_portable_app_data_on_first_run() {
        let root =
            std::env::temp_dir().join(format!("mikavn-paths-installed-{}", std::process::id()));
        let default_root = root.join("default");
        let install_dir = root.join("MikaVN Library");
        fs::create_dir_all(&install_dir).unwrap();
        fs::write(install_dir.join("uninstall.exe"), b"stub").unwrap();
        let exe = install_dir.join("mikavn-library.exe");

        let resolved = resolve_app_data_dir_from(default_root, None, Some(&exe)).unwrap();

        assert_eq!(resolved.root, install_dir.join("app-data"));
        assert_eq!(resolved.source, AppDataDirSource::Portable);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn portable_resolution_writes_marker_and_copies_default_data_once() {
        let root =
            std::env::temp_dir().join(format!("mikavn-paths-migrate-{}", std::process::id()));
        let default_root = root.join("default");
        let portable_root = root.join("install").join("app-data");
        fs::create_dir_all(default_root.join("images")).unwrap();
        fs::write(default_root.join("mikavn.db"), b"default-db").unwrap();
        fs::write(default_root.join("images").join("cover.webp"), b"cover").unwrap();

        let paths = AppPaths::from_resolution(AppDataDirResolution {
            root: portable_root.clone(),
            source: AppDataDirSource::Portable,
            default_root: default_root.clone(),
        })
        .unwrap();

        assert_eq!(paths.root(), portable_root.as_path());
        assert_eq!(fs::read(paths.database()).unwrap(), b"default-db");
        assert_eq!(
            fs::read(paths.images().join("cover.webp")).unwrap(),
            b"cover"
        );
        assert!(portable_root.join(PORTABLE_MARKER_FILE).is_file());

        fs::write(paths.database(), b"portable-db").unwrap();
        AppPaths::from_resolution(AppDataDirResolution {
            root: portable_root.clone(),
            source: AppDataDirSource::Portable,
            default_root,
        })
        .unwrap();
        assert_eq!(
            fs::read(portable_root.join("mikavn.db")).unwrap(),
            b"portable-db"
        );
        let _ = fs::remove_dir_all(root);
    }
    #[test]
    fn ignores_empty_portable_app_data_without_marker_or_database() {
        let root =
            std::env::temp_dir().join(format!("mikavn-paths-default-{}", std::process::id()));
        let default_root = root.join("default");
        let portable_root = root.join("install").join("app-data");
        fs::create_dir_all(&portable_root).unwrap();
        let exe = root.join("install").join("mikavn-library.exe");

        let resolved = resolve_app_data_dir_from(default_root.clone(), None, Some(&exe)).unwrap();

        assert_eq!(resolved.root, default_root);
        assert_eq!(resolved.source, AppDataDirSource::Default);
        let _ = fs::remove_dir_all(root);
    }
}
