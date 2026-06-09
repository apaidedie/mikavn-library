use crate::services::tray::{self, TrayStatus};

#[tauri::command]
pub fn get_tray_status() -> TrayStatus {
    tray::tray_status()
}
