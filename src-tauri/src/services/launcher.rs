use std::path::Path;
use std::process::{Child, Command};
use std::thread;

use tauri::AppHandle;

use crate::db::models::{
    CreateLaunchProfileInput, LaunchProfile, PlaySession, UpdateLaunchProfileInput,
};
use crate::db::{Database, DbError, DbResult};
use crate::infrastructure::logger;
use crate::infrastructure::paths::AppPaths;
use crate::services::saves::create_auto_save_backups;

pub fn list_launch_profiles(db: &Database, game_id: String) -> DbResult<Vec<LaunchProfile>> {
    let mut profiles = db.list_launch_profiles(game_id.clone())?;
    if profiles.is_empty() {
        if let Some(profile) = legacy_profile(db, &game_id)? {
            profiles.push(profile);
        }
    }
    Ok(profiles)
}

pub fn create_launch_profile(
    db: &Database,
    input: CreateLaunchProfileInput,
) -> DbResult<LaunchProfile> {
    db.create_launch_profile(input)
}

pub fn update_launch_profile(
    db: &Database,
    id: String,
    input: UpdateLaunchProfileInput,
) -> DbResult<LaunchProfile> {
    db.update_launch_profile(id, input)
}

pub fn delete_launch_profile(db: &Database, id: String) -> DbResult<()> {
    db.delete_launch_profile(id)
}

pub fn set_default_launch_profile(db: &Database, id: String) -> DbResult<LaunchProfile> {
    db.set_default_launch_profile(id)
}

pub fn list_play_sessions(
    db: &Database,
    game_id: String,
    limit: Option<i64>,
) -> DbResult<Vec<PlaySession>> {
    db.list_play_sessions(game_id, limit.unwrap_or(50))
}

pub fn launch_game(app: AppHandle, db: &Database, id: String) -> DbResult<PlaySession> {
    launch_game_with_profile(app, db, id, None)
}

pub fn launch_game_with_profile(
    app: AppHandle,
    db: &Database,
    id: String,
    profile_id: Option<String>,
) -> DbResult<PlaySession> {
    let game_id = id.clone();
    let profile = resolve_profile(db, &id, profile_id)?;
    validate_profile(&profile)?;

    if setting_enabled(db, "save_auto_backup_before_launch") {
        let _ = create_auto_save_backups(&app, db, &id, "启动前");
    }

    if let Some(pre_launch_command) = profile.pre_launch_command.as_deref() {
        run_shell_command(
            pre_launch_command,
            profile.working_directory.as_deref(),
            profile.environment_variables.as_deref(),
        )?;
    }

    let launch_profile_id = if profile.id.starts_with("legacy-") {
        None
    } else {
        Some(profile.id.clone())
    };
    let app_handle = app.clone();
    let post_launch_command = profile.post_launch_command.clone();
    let working_directory = profile.working_directory.clone();
    let environment_variables = profile.environment_variables.clone();

    if profile.run_as_admin {
        let tracked = launch_elevated_tracked(&profile)?;
        let session = db.create_play_session(id, launch_profile_id)?;
        let session_id = session.id.clone();
        thread::spawn(move || {
            let mut exit_status = tracked.wait_status();
            if let Some(post_launch_command) = post_launch_command.as_deref() {
                if let Err(error) = run_shell_command(
                    post_launch_command,
                    working_directory.as_deref(),
                    environment_variables.as_deref(),
                ) {
                    exit_status = Some(format!(
                        "{}; post_launch_failed: {}",
                        exit_status.unwrap_or_else(|| "unknown".to_string()),
                        error
                    ));
                }
            }
            finish_session_after_exit(&app_handle, &game_id, session_id, exit_status);
        });
        return Ok(session);
    }

    let mut command = build_launch_command(&profile)?;
    apply_command_options(&mut command, &profile);
    let child = command.spawn().map_err(|error| {
        DbError::launch_failed(format!(
            "failed to launch {}: {error}",
            profile.executable_path
        ))
    })?;
    let session = db.create_play_session(id, launch_profile_id)?;
    let session_id = session.id.clone();

    thread::spawn(move || {
        let mut exit_status = wait_child_status(child);
        if let Some(post_launch_command) = post_launch_command.as_deref() {
            if let Err(error) = run_shell_command(
                post_launch_command,
                working_directory.as_deref(),
                environment_variables.as_deref(),
            ) {
                exit_status = Some(format!(
                    "{}; post_launch_failed: {}",
                    exit_status.unwrap_or_else(|| "unknown".to_string()),
                    error
                ));
            }
        }
        finish_session_after_exit(&app_handle, &game_id, session_id, exit_status);
    });

    Ok(session)
}

fn finish_session_after_exit(
    app: &AppHandle,
    game_id: &str,
    session_id: String,
    exit_status: Option<String>,
) {
    if let Ok(paths) = AppPaths::from_app(app) {
        if let Some(status) = exit_status
            .as_deref()
            .filter(|value| value.contains("post_launch_failed"))
        {
            logger::log_warn(&paths, "launcher", status);
        }
        if let Ok(db) = Database::new_from_path(paths.database()) {
            if setting_enabled(&db, "save_auto_backup_after_exit") {
                let _ = create_auto_save_backups(app, &db, game_id, "退出后");
            }
            let _ = db.finish_play_session(session_id, exit_status);
        }
    }
}

fn wait_child_status(mut child: Child) -> Option<String> {
    child
        .wait()
        .ok()
        .and_then(|status| status.code())
        .map(|code| code.to_string())
        .or_else(|| Some("unknown".to_string()))
}

fn setting_enabled(db: &Database, key: &str) -> bool {
    db.get_setting(key).ok().flatten().as_deref() == Some("true")
}

fn resolve_profile(
    db: &Database,
    game_id: &str,
    profile_id: Option<String>,
) -> DbResult<LaunchProfile> {
    if let Some(profile_id) = profile_id.filter(|value| !value.trim().is_empty()) {
        let profile = db.get_launch_profile(&profile_id)?;
        if profile.game_id != game_id {
            return Err(DbError::validation(
                "launch profile does not belong to this game",
            ));
        }
        return Ok(profile);
    }

    if let Some(profile) = db.get_default_launch_profile(game_id)? {
        return Ok(profile);
    }

    legacy_profile(db, game_id)?
        .ok_or_else(|| DbError::executable_not_found("this game has no executable path"))
}

fn legacy_profile(db: &Database, game_id: &str) -> DbResult<Option<LaunchProfile>> {
    let game = db.get_game(game_id.to_string())?;
    let Some(executable_path) = game.executable_path.clone() else {
        return Ok(None);
    };

    Ok(Some(LaunchProfile {
        id: format!("legacy-{game_id}"),
        game_id: game.id,
        name: "默认启动".to_string(),
        executable_path,
        working_directory: game.working_directory.or(Some(game.install_path)),
        arguments: game.launch_args,
        environment_variables: None,
        runner_type: "direct".to_string(),
        locale_emulator_path: None,
        pre_launch_command: None,
        post_launch_command: None,
        run_as_admin: false,
        is_default: true,
        compatibility_notes: Some("来自旧版游戏启动字段".to_string()),
        created_at: game.created_at,
        updated_at: game.updated_at,
    }))
}

fn validate_profile(profile: &LaunchProfile) -> DbResult<()> {
    match profile.runner_type.as_str() {
        "direct" | "shortcut_lnk" => {
            validate_existing_file(&profile.executable_path, "launch executable does not exist")?
        }
        "locale_emulator" => {
            validate_existing_file(&profile.executable_path, "launch executable does not exist")?;
            let locale_emulator_path = profile
                .locale_emulator_path
                .as_deref()
                .filter(|value| !value.trim().is_empty())
                .ok_or_else(|| DbError::validation("locale emulator path is required"))?;
            validate_existing_file(
                locale_emulator_path,
                "locale emulator executable does not exist",
            )?;
        }
        "custom_command" => {
            if profile.executable_path.trim().is_empty() {
                return Err(DbError::validation("custom command is required"));
            }
        }
        _ => {
            return Err(DbError::launch_failed(
                "unsupported launch profile runner type",
            ))
        }
    }

    if let Some(working_directory) = profile.working_directory.as_deref() {
        let path = Path::new(working_directory);
        if !path.exists() || !path.is_dir() {
            return Err(DbError::path_not_found("working directory does not exist"));
        }
    }

    Ok(())
}

fn validate_existing_file(path: &str, message: &str) -> DbResult<()> {
    let executable = Path::new(path);
    if !executable.exists() || !executable.is_file() {
        return Err(DbError::executable_not_found(message));
    }
    Ok(())
}

fn build_launch_command(profile: &LaunchProfile) -> DbResult<Command> {
    match profile.runner_type.as_str() {
        "shortcut_lnk" => {
            #[cfg(windows)]
            {
                let mut command = Command::new("cmd");
                command.args(["/C", "start", "", &profile.executable_path]);
                append_profile_args(&mut command, profile.arguments.as_deref());
                Ok(command)
            }
            #[cfg(not(windows))]
            {
                let mut command = Command::new(&profile.executable_path);
                append_profile_args(&mut command, profile.arguments.as_deref());
                Ok(command)
            }
        }
        "locale_emulator" => {
            let locale_emulator_path = profile
                .locale_emulator_path
                .as_deref()
                .ok_or_else(|| DbError::validation("locale emulator path is required"))?;
            let mut command = Command::new(locale_emulator_path);
            command.arg(&profile.executable_path);
            append_profile_args(&mut command, profile.arguments.as_deref());
            Ok(command)
        }
        "custom_command" => {
            #[cfg(windows)]
            {
                let mut command = Command::new("cmd");
                let mut command_line = profile.executable_path.clone();
                if let Some(args) = profile
                    .arguments
                    .as_deref()
                    .filter(|value| !value.trim().is_empty())
                {
                    command_line.push(' ');
                    command_line.push_str(args);
                }
                command.args(["/C", &command_line]);
                Ok(command)
            }
            #[cfg(not(windows))]
            {
                let mut command = Command::new("sh");
                let mut command_line = profile.executable_path.clone();
                if let Some(args) = profile
                    .arguments
                    .as_deref()
                    .filter(|value| !value.trim().is_empty())
                {
                    command_line.push(' ');
                    command_line.push_str(args);
                }
                command.args(["-c", &command_line]);
                Ok(command)
            }
        }
        "direct" => {
            let mut command = Command::new(&profile.executable_path);
            append_profile_args(&mut command, profile.arguments.as_deref());
            Ok(command)
        }
        _ => Err(DbError::launch_failed(
            "unsupported launch profile runner type",
        )),
    }
}

struct TrackedElevatedProcess {
    #[cfg(windows)]
    handle: isize,
}

impl TrackedElevatedProcess {
    fn wait_status(self) -> Option<String> {
        #[cfg(windows)]
        {
            wait_for_process_handle(self.handle)
        }

        #[cfg(not(windows))]
        unreachable!("elevated launch is only constructed on Windows")
    }
}

fn launch_elevated_tracked(profile: &LaunchProfile) -> DbResult<TrackedElevatedProcess> {
    #[cfg(windows)]
    {
        launch_elevated_shell_execute(profile)
    }

    #[cfg(not(windows))]
    {
        let _ = profile;
        Err(DbError::launch_failed(
            "run as administrator is only supported on Windows",
        ))
    }
}

#[cfg(windows)]
fn launch_elevated_shell_execute(profile: &LaunchProfile) -> DbResult<TrackedElevatedProcess> {
    use std::mem::size_of;
    use std::ptr::null_mut;

    use windows::core::PCWSTR;
    use windows::Win32::Foundation::{GetLastError, HWND};
    use windows::Win32::UI::Shell::{ShellExecuteExW, SEE_MASK_NOCLOSEPROCESS, SHELLEXECUTEINFOW};
    use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

    let verb = wide_null("runas");
    let file = wide_null(&profile.executable_path);
    let parameters = profile
        .arguments
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .map(wide_null);
    let directory = profile
        .working_directory
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .map(wide_null);

    let mut info = SHELLEXECUTEINFOW {
        cbSize: size_of::<SHELLEXECUTEINFOW>() as u32,
        fMask: SEE_MASK_NOCLOSEPROCESS,
        hwnd: HWND(null_mut()),
        lpVerb: PCWSTR(verb.as_ptr()),
        lpFile: PCWSTR(file.as_ptr()),
        lpParameters: parameters
            .as_ref()
            .map_or(PCWSTR::null(), |value| PCWSTR(value.as_ptr())),
        lpDirectory: directory
            .as_ref()
            .map_or(PCWSTR::null(), |value| PCWSTR(value.as_ptr())),
        nShow: SW_SHOWNORMAL.0,
        ..Default::default()
    };

    unsafe {
        ShellExecuteExW(&mut info).map_err(|error| {
            let last_error = GetLastError();
            elevated_launch_error(error, last_error)
        })?;
    }

    if info.hProcess.is_invalid() || info.hProcess.0.is_null() {
        return Err(DbError::launch_failed(
            "elevated launch did not return a process handle",
        ));
    }

    Ok(TrackedElevatedProcess {
        handle: info.hProcess.0 as isize,
    })
}

#[cfg(windows)]
fn elevated_launch_error(
    error: windows::core::Error,
    last_error: windows::Win32::Foundation::WIN32_ERROR,
) -> DbError {
    use windows::Win32::Foundation::ERROR_CANCELLED;

    if last_error == ERROR_CANCELLED {
        DbError::launch_cancelled("UAC authorization was cancelled by the user")
    } else {
        DbError::launch_failed(format!(
            "failed to request elevated launch: {error}; last_error={last_error:?}"
        ))
    }
}

#[cfg(windows)]
fn wait_for_process_handle(handle: isize) -> Option<String> {
    use windows::Win32::Foundation::{CloseHandle, HANDLE};
    use windows::Win32::System::Threading::{GetExitCodeProcess, WaitForSingleObject, INFINITE};

    let handle = HANDLE(handle as *mut core::ffi::c_void);
    let mut exit_code = 0_u32;
    unsafe {
        let _ = WaitForSingleObject(handle, INFINITE);
        let status = if GetExitCodeProcess(handle, &mut exit_code).is_ok() {
            Some(exit_code.to_string())
        } else {
            Some("unknown".to_string())
        };
        let _ = CloseHandle(handle);
        status
    }
}

#[cfg(windows)]
fn wide_null(value: &str) -> Vec<u16> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;

    OsStr::new(value)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect()
}

fn apply_command_options(command: &mut Command, profile: &LaunchProfile) {
    if let Some(working_directory) = profile.working_directory.clone() {
        command.current_dir(working_directory);
    }
    apply_environment(command, profile.environment_variables.as_deref());
}

fn append_profile_args(command: &mut Command, args: Option<&str>) {
    if let Some(args) = args {
        for arg in split_args(args) {
            command.arg(arg);
        }
    }
}

fn run_shell_command(
    command_line: &str,
    working_directory: Option<&str>,
    environment_variables: Option<&str>,
) -> DbResult<()> {
    if command_line.trim().is_empty() {
        return Ok(());
    }

    #[cfg(windows)]
    let mut command = {
        let mut command = Command::new("cmd");
        command.args(["/C", command_line]);
        command
    };

    #[cfg(not(windows))]
    let mut command = {
        let mut command = Command::new("sh");
        command.args(["-c", command_line]);
        command
    };

    if let Some(working_directory) = working_directory {
        command.current_dir(working_directory);
    }
    apply_environment(&mut command, environment_variables);

    let status = command
        .status()
        .map_err(|error| DbError::launch_failed(format!("failed to run hook command: {error}")))?;
    if status.success() {
        Ok(())
    } else {
        Err(DbError::launch_failed(format!(
            "hook command exited with status {status}"
        )))
    }
}

fn apply_environment(command: &mut Command, environment_variables: Option<&str>) {
    let Some(environment_variables) = environment_variables else {
        return;
    };

    for line in environment_variables.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        if let Some((key, value)) = trimmed.split_once('=') {
            command.env(key.trim(), value.trim());
        }
    }
}

fn split_args(args: &str) -> Vec<String> {
    let mut result = Vec::new();
    let mut current = String::new();
    let mut quote: Option<char> = None;

    for ch in args.chars() {
        if let Some(active_quote) = quote {
            if ch == active_quote {
                quote = None;
            } else {
                current.push(ch);
            }
            continue;
        }
        if ch == '"' || ch == '\'' {
            quote = Some(ch);
            continue;
        }
        if ch.is_whitespace() {
            if !current.is_empty() {
                result.push(std::mem::take(&mut current));
            }
        } else {
            current.push(ch);
        }
    }
    if !current.is_empty() {
        result.push(current);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::time::{Duration, Instant};

    #[test]
    fn split_args_preserves_quoted_values() {
        assert_eq!(
            split_args(r#"--name "Alice VN" --flag 'JP Locale'"#),
            vec!["--name", "Alice VN", "--flag", "JP Locale"]
        );
    }

    #[test]
    fn split_args_preserves_windows_paths() {
        assert_eq!(
            split_args(r#"--path C:\Games\VN --quoted "D:\VN Tools\runner.exe""#),
            vec![
                "--path",
                r#"C:\Games\VN"#,
                "--quoted",
                r#"D:\VN Tools\runner.exe"#
            ]
        );
    }

    #[test]
    fn custom_command_accepts_shell_command_text() {
        let mut profile = test_profile("custom_command");
        profile.executable_path = "echo hello".to_string();
        assert!(validate_profile(&profile).is_ok());
    }

    #[cfg(windows)]
    #[test]
    fn launcher_profile_smoke_runs_direct_shortcut_custom_and_locale_wrappers() {
        let root = launcher_smoke_root();
        fs::create_dir_all(&root).unwrap();
        let command_processor =
            std::env::var("ComSpec").unwrap_or_else(|_| r"C:\Windows\System32\cmd.exe".to_string());

        let direct_marker = root.join("direct.txt");
        let mut direct = test_profile("direct");
        direct.executable_path = command_processor.clone();
        direct.arguments = Some(format!("/C echo direct>{}", direct_marker.display()));
        run_profile_and_wait_for_marker(&direct, &direct_marker);

        let shortcut_marker = root.join("shortcut.txt");
        let shortcut_script = root.join("shortcut-target.cmd");
        fs::write(
            &shortcut_script,
            format!(
                "@echo off\r\necho shortcut>{}\r\n",
                shortcut_marker.display()
            ),
        )
        .unwrap();
        let mut shortcut = test_profile("shortcut_lnk");
        shortcut.executable_path = shortcut_script.to_string_lossy().to_string();
        run_profile_and_wait_for_marker(&shortcut, &shortcut_marker);

        let custom_marker = root.join("custom.txt");
        let mut custom = test_profile("custom_command");
        custom.executable_path = format!("echo custom>{}", custom_marker.display());
        run_profile_and_wait_for_marker(&custom, &custom_marker);

        let locale_marker = root.join("locale.txt");
        let mut locale = test_profile("locale_emulator");
        locale.executable_path = "/C".to_string();
        locale.locale_emulator_path = Some(command_processor);
        locale.arguments = Some(format!("echo locale>{}", locale_marker.display()));
        run_profile_and_wait_for_marker(&locale, &locale_marker);

        let _ = fs::remove_dir_all(root);
    }

    #[cfg(windows)]
    #[test]
    fn elevated_cancel_maps_to_launch_cancelled() {
        use windows::core::Error;
        use windows::Win32::Foundation::ERROR_CANCELLED;

        let error = elevated_launch_error(Error::from_win32(), ERROR_CANCELLED);

        assert_eq!(error.code, "LAUNCH_CANCELLED");
    }

    fn test_profile(runner_type: &str) -> LaunchProfile {
        LaunchProfile {
            id: "profile".to_string(),
            game_id: "game".to_string(),
            name: "Default".to_string(),
            executable_path: "cmd".to_string(),
            working_directory: None,
            arguments: None,
            environment_variables: None,
            runner_type: runner_type.to_string(),
            locale_emulator_path: None,
            pre_launch_command: None,
            post_launch_command: None,
            run_as_admin: false,
            is_default: true,
            compatibility_notes: None,
            created_at: String::new(),
            updated_at: String::new(),
        }
    }

    #[cfg(windows)]
    fn launcher_smoke_root() -> PathBuf {
        std::env::temp_dir().join(format!(
            "mikavn-launcher-profile-smoke-{}",
            uuid::Uuid::new_v4()
        ))
    }

    #[cfg(windows)]
    fn run_profile_and_wait_for_marker(profile: &LaunchProfile, marker: &Path) {
        let mut command = build_launch_command(profile).unwrap();
        apply_command_options(&mut command, profile);
        let status = command.status().unwrap();
        assert!(
            status.success(),
            "launcher command failed for {}",
            profile.runner_type
        );
        wait_for_marker(marker);
    }

    #[cfg(windows)]
    fn wait_for_marker(path: &Path) {
        let deadline = Instant::now() + Duration::from_secs(5);
        while Instant::now() < deadline {
            if path.is_file() {
                return;
            }
            std::thread::sleep(Duration::from_millis(100));
        }
        panic!("launcher marker was not written: {}", path.display());
    }
}
