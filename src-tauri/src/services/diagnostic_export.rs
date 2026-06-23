use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use chrono::Utc;
use serde::Serialize;
use serde_json::Value;
use tauri::AppHandle;
use uuid::Uuid;
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipWriter};

use crate::db::DbResult;
use crate::infrastructure::logger;
use crate::infrastructure::paths::AppPaths;
use crate::services::{diagnostics, logs};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticExportReport {
    pub path: String,
    pub file_name: String,
    pub size_bytes: u64,
    pub created_at: String,
    pub included_files: Vec<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DiagnosticManifest {
    app: &'static str,
    export_schema_version: i64,
    created_at: String,
    data_dir_source: String,
    included_files: Vec<String>,
    exclusions: Vec<&'static str>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DiagnosticEnvironment {
    app_version: String,
    platform: &'static str,
    export_schema_version: i64,
}

pub fn export_diagnostic_package(app: &AppHandle) -> DbResult<DiagnosticExportReport> {
    let resolution = AppPaths::resolve_from_app(app)?;
    let paths = AppPaths::from_root(resolution.root)?;
    export_diagnostic_package_with_version(
        &paths,
        resolution.source.as_str().to_string(),
        app.package_info().version.to_string(),
    )
}

#[cfg(test)]
pub(crate) fn export_diagnostic_package_with_paths(
    paths: &AppPaths,
    data_dir_source: String,
) -> DbResult<DiagnosticExportReport> {
    export_diagnostic_package_with_version(paths, data_dir_source, "test".to_string())
}

fn export_diagnostic_package_with_version(
    paths: &AppPaths,
    data_dir_source: String,
    app_version: String,
) -> DbResult<DiagnosticExportReport> {
    let created_at = Utc::now().to_rfc3339();
    let stamp = Utc::now().format("%Y%m%d-%H%M%S").to_string();
    let export_dir = paths.root().join("diagnostic-exports");
    let staging_dir = paths
        .cache()
        .join("diagnostic-export-staging")
        .join(Uuid::new_v4().to_string());
    fs::create_dir_all(&export_dir)?;
    fs::create_dir_all(&staging_dir)?;

    let result = write_diagnostic_package(
        paths,
        &data_dir_source,
        &app_version,
        &created_at,
        &export_dir.join(format!("mikavn-diagnostics-{stamp}.zip")),
        &staging_dir,
    );
    let _ = fs::remove_dir_all(&staging_dir);
    result
}

fn write_diagnostic_package(
    paths: &AppPaths,
    data_dir_source: &str,
    app_version: &str,
    created_at: &str,
    target: &Path,
    staging_dir: &Path,
) -> DbResult<DiagnosticExportReport> {
    let diagnostics =
        diagnostics::get_app_data_diagnostics_with_paths(paths, data_dir_source.to_string())?;
    let logs = logs::list_diagnostic_logs_from_paths(paths, Some(8))?;
    let included_files = vec![
        "manifest.json".to_string(),
        "diagnostics.json".to_string(),
        "summary.md".to_string(),
        "logs-preview.json".to_string(),
        "environment.json".to_string(),
    ];
    let manifest = DiagnosticManifest {
        app: "MikaVN Library",
        export_schema_version: 1,
        created_at: created_at.to_string(),
        data_dir_source: data_dir_source.to_string(),
        included_files: included_files.clone(),
        exclusions: vec![
            "full database",
            "image cache files",
            "save backup contents",
            "game installation folders",
            "raw log files",
        ],
    };
    let environment = DiagnosticEnvironment {
        app_version: app_version.to_string(),
        platform: "windows",
        export_schema_version: 1,
    };

    write_redacted_json(staging_dir.join("manifest.json"), &manifest)?;
    write_redacted_json(staging_dir.join("diagnostics.json"), &diagnostics)?;
    write_redacted_text(
        staging_dir.join("summary.md"),
        &diagnostic_summary(&diagnostics, app_version),
    )?;
    write_redacted_json(staging_dir.join("logs-preview.json"), &logs)?;
    write_redacted_json(staging_dir.join("environment.json"), &environment)?;
    zip_generated_files(staging_dir, target, &included_files)?;

    let metadata = fs::metadata(target)?;
    Ok(DiagnosticExportReport {
        path: target.to_string_lossy().to_string(),
        file_name: target
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("mikavn-diagnostics.zip")
            .to_string(),
        size_bytes: metadata.len(),
        created_at: created_at.to_string(),
        included_files,
        warnings: diagnostics.warnings,
    })
}

fn write_redacted_json(path: PathBuf, value: &impl Serialize) -> DbResult<()> {
    let mut json = serde_json::to_value(value)?;
    redact_json_value(&mut json);
    fs::write(path, serde_json::to_string_pretty(&json)?)?;
    Ok(())
}

fn write_redacted_text(path: PathBuf, value: &str) -> DbResult<()> {
    fs::write(path, logger::redact_sensitive_text(value))?;
    Ok(())
}

fn redact_json_value(value: &mut Value) {
    match value {
        Value::String(text) => *text = logger::redact_sensitive_text(text),
        Value::Array(items) => {
            for item in items {
                redact_json_value(item);
            }
        }
        Value::Object(map) => {
            for (key, item) in map.iter_mut() {
                if is_sensitive_json_key(key) {
                    *item = Value::String("[redacted]".to_string());
                } else {
                    redact_json_value(item);
                }
            }
        }
        _ => {}
    }
}

fn is_sensitive_json_key(key: &str) -> bool {
    let normalized = key
        .chars()
        .filter(|character| !matches!(character, '_' | '-'))
        .flat_map(char::to_lowercase)
        .collect::<String>();

    matches!(
        normalized.as_str(),
        "authorization"
            | "apikey"
            | "accesstoken"
            | "refreshtoken"
            | "clientsecret"
            | "authtoken"
            | "idtoken"
            | "privatekey"
            | "signingkey"
            | "sessionid"
            | "session"
            | "cookie"
            | "jwt"
            | "secret"
            | "token"
            | "password"
    )
}

fn diagnostic_summary(diagnostics: &diagnostics::AppDataDiagnostics, app_version: &str) -> String {
    let mut summary = format!(
        "# MikaVN Diagnostic Summary\n\n- 应用版本：{}\n- 数据目录来源：{}\n- 数据库 quick_check：{}\n- 游戏数量：{}\n- 媒体资产：{}\n- 图片文件：{}\n- 日志文件：{}\n- 数据库备份：{}\n- 警告数量：{}\n",
        app_version,
        diagnostics.data_dir_source,
        diagnostics
            .database
            .quick_check
            .as_deref()
            .unwrap_or("unknown"),
        diagnostics.database.game_count,
        diagnostics.database.asset_count,
        diagnostics.images.file_count,
        diagnostics.logs.file_count,
        diagnostics.database_backups.file_count,
        diagnostics.warnings.len()
    );
    if !diagnostics.warnings.is_empty() {
        summary.push_str("\n## 警告摘要\n\n");
        for warning in diagnostics.warnings.iter().take(5) {
            summary.push_str("- ");
            summary.push_str(warning);
            summary.push('\n');
        }
        if diagnostics.warnings.len() > 5 {
            summary.push_str(&format!(
                "- 还有 {} 条警告，见 diagnostics.json。\n",
                diagnostics.warnings.len() - 5
            ));
        }
    }
    summary
}

fn zip_generated_files(
    staging_dir: &Path,
    target: &Path,
    included_files: &[String],
) -> DbResult<()> {
    let file = fs::File::create(target)?;
    let mut writer = ZipWriter::new(file);
    let options = SimpleFileOptions::default()
        .compression_method(CompressionMethod::Deflated)
        .unix_permissions(0o644);
    for name in included_files {
        let path = staging_dir.join(name);
        writer.start_file(name, options)?;
        let bytes = fs::read(path)?;
        writer.write_all(&bytes)?;
    }
    writer.finish()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn diagnostic_export_redacts_structured_secret_fields_by_key() {
        let mut value = json!({
            "api_key": "plain-api-secret",
            "authorization": "Bearer plain-bearer-secret",
            "nested": {
                "session_id": "plain-session-secret",
                "private_key": "plain-private-secret"
            },
            "items": [
                {
                    "client_secret": "plain-client-secret"
                }
            ],
            "title": "Safe VN"
        });

        redact_json_value(&mut value);
        let output = value.to_string();

        assert!(output.contains("[redacted]"));
        assert!(!output.contains("plain-api-secret"));
        assert!(!output.contains("plain-bearer-secret"));
        assert!(!output.contains("plain-session-secret"));
        assert!(!output.contains("plain-private-secret"));
        assert!(!output.contains("plain-client-secret"));
        assert!(output.contains("Safe VN"));
    }
}
