use serde::Serialize;
use tauri::menu::MenuBuilder;
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, Runtime, Window, WindowEvent};

const MENU_OPEN: &str = "tray-open";
const MENU_HIDE: &str = "tray-hide";
const MENU_EXIT: &str = "tray-exit";
const LABEL_OPEN: &str = "打开 MikaVN";
const LABEL_HIDE: &str = "隐藏到托盘";
const LABEL_EXIT: &str = "退出";
const MAIN_WINDOW_LABEL: &str = "main";
const TRAY_TOOLTIP: &str = "MikaVN Library";
const CLOSE_BEHAVIOR_HIDE_TO_TRAY: &str = "hide_to_tray";

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayMenuItemStatus {
    pub id: String,
    pub label: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayStatus {
    pub enabled: bool,
    pub tooltip: String,
    pub close_behavior: String,
    pub menu_items: Vec<TrayMenuItemStatus>,
}

pub fn tray_status() -> TrayStatus {
    TrayStatus {
        enabled: true,
        tooltip: TRAY_TOOLTIP.to_string(),
        close_behavior: CLOSE_BEHAVIOR_HIDE_TO_TRAY.to_string(),
        menu_items: vec![
            TrayMenuItemStatus {
                id: MENU_OPEN.to_string(),
                label: LABEL_OPEN.to_string(),
            },
            TrayMenuItemStatus {
                id: MENU_HIDE.to_string(),
                label: LABEL_HIDE.to_string(),
            },
            TrayMenuItemStatus {
                id: MENU_EXIT.to_string(),
                label: LABEL_EXIT.to_string(),
            },
        ],
    }
}

pub fn setup_app_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let menu = MenuBuilder::new(app)
        .text(MENU_OPEN, LABEL_OPEN)
        .text(MENU_HIDE, LABEL_HIDE)
        .separator()
        .text(MENU_EXIT, LABEL_EXIT)
        .build()?;
    let Some(tray_icon) = app.default_window_icon().cloned() else {
        return Ok(());
    };

    let app_for_menu = app.clone();
    let app_for_tray = app.clone();
    TrayIconBuilder::with_id("main")
        .icon(tray_icon)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip(TRAY_TOOLTIP)
        .on_menu_event(move |_app, event| match event.id().0.as_str() {
            MENU_OPEN => show_main_window(&app_for_menu),
            MENU_HIDE => hide_main_window(&app_for_menu),
            MENU_EXIT => app_for_menu.exit(0),
            _ => {}
        })
        .on_tray_icon_event(move |_tray, event| match event {
            TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            }
            | TrayIconEvent::DoubleClick {
                button: MouseButton::Left,
                ..
            } => show_main_window(&app_for_tray),
            _ => {}
        })
        .build(app)?;

    Ok(())
}

pub fn hide_instead_of_close<R: Runtime>(event: &WindowEvent, window: &Window<R>) {
    if let WindowEvent::CloseRequested { api, .. } = event {
        api.prevent_close();
        let _ = window.hide();
    }
}

fn show_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn hide_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        let _ = window.hide();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tray_status_documents_menu_and_close_behavior() {
        let status = tray_status();

        assert!(status.enabled);
        assert_eq!(status.tooltip, "MikaVN Library");
        assert_eq!(status.close_behavior, "hide_to_tray");
        assert!(status
            .menu_items
            .iter()
            .any(|item| item.id == MENU_OPEN && item.label == "打开 MikaVN"));
        assert!(status
            .menu_items
            .iter()
            .any(|item| item.id == MENU_HIDE && item.label == "隐藏到托盘"));
        assert!(status
            .menu_items
            .iter()
            .any(|item| item.id == MENU_EXIT && item.label == "退出"));
    }
}
