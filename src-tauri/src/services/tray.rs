use tauri::menu::MenuBuilder;
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, Runtime, Window, WindowEvent};

const MENU_OPEN: &str = "tray-open";
const MENU_HIDE: &str = "tray-hide";
const MENU_EXIT: &str = "tray-exit";
const MAIN_WINDOW_LABEL: &str = "main";

pub fn setup_app_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let menu = MenuBuilder::new(app)
        .text(MENU_OPEN, "打开 MikaVN")
        .text(MENU_HIDE, "隐藏到托盘")
        .separator()
        .text(MENU_EXIT, "退出")
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
        .tooltip("MikaVN Library")
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
