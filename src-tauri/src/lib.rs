mod commands;
mod db;
mod error;
mod infrastructure;
mod repositories;
mod services;

use std::sync::{Mutex, MutexGuard};

use db::Database;
use error::{AppError, AppResult};
use tauri::Manager;

pub struct AppState {
    db: Mutex<Database>,
}

impl AppState {
    pub fn db(&self) -> AppResult<MutexGuard<'_, Database>> {
        self.db
            .lock()
            .map_err(|_| AppError::internal("database state is unavailable"))
    }
}

pub fn run() {
    tauri::Builder::default()
        .register_uri_scheme_protocol("mikavn-image", |ctx, request| {
            services::images::handle_local_image_protocol_request(ctx.app_handle(), request)
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let paths = infrastructure::paths::AppPaths::from_app(app.handle())?;
            services::backups::apply_pending_database_restore(&paths)?;
            let db = Database::new(app.handle())?;
            let auto_backup_setting = db
                .get_setting("database_auto_backup_on_startup")
                .ok()
                .flatten();
            if auto_backup_setting.as_deref() != Some("false") {
                if let Err(error) =
                    services::backups::create_startup_automatic_backup_if_needed(&paths)
                {
                    infrastructure::logger::log_error(
                        &paths,
                        "database.backup",
                        format!("startup automatic backup failed: {error}"),
                    );
                }
            }
            services::tray::apply_tray_setting(app.handle(), &db)?;
            app.manage(AppState { db: Mutex::new(db) });
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let Some(state) = window.try_state::<AppState>() {
                    if let Ok(db) = state.db() {
                        services::tray::hide_instead_of_close(event, window, &db);
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::games::add_game,
            commands::games::update_game,
            commands::games::delete_game_record,
            commands::games::list_games,
            commands::games::get_game,
            commands::games::check_game_paths,
            commands::games::check_game_paths_task,
            commands::games::relocate_game_paths,
            commands::archives::export_library_archive,
            commands::archives::export_library_archive_zip,
            commands::archives::preview_library_archive,
            commands::archives::import_library_archive,
            commands::archives::restore_library_archive,
            commands::assets::list_game_assets,
            commands::assets::upsert_game_asset,
            commands::assets::remove_game_asset,
            commands::assets::set_primary_asset,
            commands::assets::import_game_asset_from_path,
            commands::assets::download_game_asset,
            commands::assets::cleanup_asset_cache,
            commands::assets::preview_asset_cache_cleanup,
            commands::assets::list_tags,
            commands::assets::rename_tag,
            commands::assets::merge_tags,
            commands::assets::delete_tag,
            commands::backups::backup_database,
            commands::backups::backup_database_before_update,
            commands::backups::restore_database_backup,
            commands::diagnostics::get_app_data_diagnostics,
            commands::diagnostics::export_diagnostic_package,
            commands::diagnostics::audit_image_references,
            commands::diagnostics::get_image_health_report,
            commands::diagnostics::quarantine_orphan_images,
            commands::diagnostics::quarantine_duplicate_content_images,
            commands::diagnostics::cleanup_old_database_backups,
            commands::collections::list_collections,
            commands::collections::create_collection,
            commands::collections::update_collection,
            commands::collections::delete_collection,
            commands::collections::list_collection_games,
            commands::collections::add_game_to_collection,
            commands::collections::remove_game_from_collection,
            commands::filesystem::reveal_path,
            commands::reports::get_dashboard,
            commands::reports::export_report_markdown,
            commands::reports::export_report_markdown_task,
            commands::launcher::launch_game,
            commands::launcher::launch_game_with_profile,
            commands::launcher::list_launch_profiles,
            commands::launcher::create_launch_profile,
            commands::launcher::update_launch_profile,
            commands::launcher::delete_launch_profile,
            commands::launcher::set_default_launch_profile,
            commands::launcher::list_play_sessions,
            commands::logs::list_diagnostic_logs,
            commands::logs::prune_diagnostic_logs,
            commands::logs::get_log_retention,
            commands::scanner::add_library_root,
            commands::scanner::list_library_roots,
            commands::scanner::update_library_root,
            commands::scanner::remove_library_root,
            commands::scanner::scan_library_root,
            commands::scanner::scan_path_preview,
            commands::scanner::start_scan_task,
            commands::scanner::get_scan_task_status,
            commands::scanner::import_scan_candidates,
            commands::search::search_games_advanced,
            commands::search::validate_search_query,
            commands::search::list_saved_searches,
            commands::search::create_saved_search,
            commands::search::update_saved_search,
            commands::search::delete_saved_search,
            commands::metadata::search_metadata,
            commands::metadata::get_metadata_detail,
            commands::metadata::match_metadata_for_game,
            commands::metadata::apply_metadata_to_game,
            commands::metadata::list_metadata_sources,
            commands::metadata::list_external_ids,
            commands::metadata::list_field_locks,
            commands::metadata::set_field_lock,
            commands::metadata::set_field_locks,
            commands::metadata::batch_match_metadata,
            commands::metadata::preview_description_image_repair,
            commands::metadata::repair_description_images,
            commands::metadata::preview_artwork_repair,
            commands::metadata::diagnose_artwork_repair,
            commands::metadata::repair_artwork,
            commands::metadata::preview_duplicate_external_ids,
            commands::metadata::audit_duplicate_external_ids,
            commands::metadata::preview_duplicate_game_merge,
            commands::metadata::merge_duplicate_games,
            commands::metadata::get_batch_match_status,
            commands::metadata::cancel_batch_match,
            commands::metadata::recognize_game_from_image,
            commands::metadata::test_ai_connection,
            commands::settings::get_app_settings,
            commands::settings::set_app_setting,
            commands::settings::set_app_settings,
            commands::tasks::create_task,
            commands::tasks::list_tasks,
            commands::tasks::get_task,
            commands::tasks::get_task_detail,
            commands::tasks::list_task_logs,
            commands::tasks::update_task,
            commands::tasks::cancel_task,
            commands::tasks::retry_task,
            commands::tray::get_tray_status,
            commands::saves::list_save_paths,
            commands::saves::add_save_path,
            commands::saves::remove_save_path,
            commands::saves::suggest_save_paths,
            commands::saves::create_save_backup,
            commands::saves::create_save_backup_task,
            commands::saves::list_save_backups,
            commands::saves::restore_save_backup,
            commands::saves::restore_save_backup_task,
            commands::saves::preview_save_restore,
            commands::saves::delete_save_backup_record,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run MikaVN Library");
}
