use tauri::AppHandle;

use crate::db::DbResult;
use crate::services::backups as backup_service;
use crate::services::backups::{DatabaseBackupCleanupPolicy, DatabaseBackupCleanupReport};
use crate::services::diagnostic_export::{self, DiagnosticExportReport};
use crate::services::diagnostics::{
    self, AppDataDiagnostics, ImageReferenceAudit, ImageReferenceAuditOptions,
};
use crate::services::image_health::{
    self, ImageHealthReport, ImageHealthReportOptions, ImageQuarantineReport,
};

#[tauri::command]
pub fn get_app_data_diagnostics(app: AppHandle) -> DbResult<AppDataDiagnostics> {
    diagnostics::get_app_data_diagnostics(&app)
}

#[tauri::command]
pub fn export_diagnostic_package(app: AppHandle) -> DbResult<DiagnosticExportReport> {
    diagnostic_export::export_diagnostic_package(&app)
}

#[tauri::command]
pub fn audit_image_references(
    app: AppHandle,
    options: ImageReferenceAuditOptions,
) -> DbResult<ImageReferenceAudit> {
    diagnostics::audit_image_references(&app, options)
}

#[tauri::command]
pub fn get_image_health_report(
    app: AppHandle,
    options: ImageHealthReportOptions,
) -> DbResult<ImageHealthReport> {
    image_health::get_image_health_report(&app, options)
}

#[tauri::command]
pub fn quarantine_orphan_images(
    app: AppHandle,
    options: ImageHealthReportOptions,
) -> DbResult<ImageQuarantineReport> {
    image_health::quarantine_orphan_images(&app, options)
}

#[tauri::command]
pub fn quarantine_duplicate_content_images(
    app: AppHandle,
    options: ImageHealthReportOptions,
) -> DbResult<ImageQuarantineReport> {
    image_health::quarantine_duplicate_content_images(&app, options)
}

#[tauri::command]
pub fn cleanup_old_database_backups(
    app: AppHandle,
    policy: DatabaseBackupCleanupPolicy,
) -> DbResult<DatabaseBackupCleanupReport> {
    backup_service::cleanup_old_database_backups(&app, policy)
}
