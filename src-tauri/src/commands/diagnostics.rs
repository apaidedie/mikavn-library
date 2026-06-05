use tauri::AppHandle;

use crate::db::DbResult;
use crate::services::backups as backup_service;
use crate::services::backups::{DatabaseBackupCleanupPolicy, DatabaseBackupCleanupReport};
use crate::services::diagnostics::{
    self, AppDataDiagnostics, ImageReferenceAudit, ImageReferenceAuditOptions,
};

#[tauri::command]
pub fn get_app_data_diagnostics(app: AppHandle) -> DbResult<AppDataDiagnostics> {
    diagnostics::get_app_data_diagnostics(&app)
}

#[tauri::command]
pub fn audit_image_references(
    app: AppHandle,
    options: ImageReferenceAuditOptions,
) -> DbResult<ImageReferenceAudit> {
    diagnostics::audit_image_references(&app, options)
}

#[tauri::command]
pub fn cleanup_old_database_backups(
    app: AppHandle,
    policy: DatabaseBackupCleanupPolicy,
) -> DbResult<DatabaseBackupCleanupReport> {
    backup_service::cleanup_old_database_backups(&app, policy)
}
