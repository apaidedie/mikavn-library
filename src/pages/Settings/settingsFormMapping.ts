import type { SettingsForm } from './settingsTypes';

export const DEFAULT_SETTINGS_FORM: SettingsForm = {
  provider_vndb_enabled: true,
  provider_bangumi_enabled: true,
  provider_dlsite_enabled: true,
  provider_fanza_enabled: true,
  provider_ymgal_enabled: true,
  ai_base_url: '',
  ai_model: 'gpt-4o-mini',
  ai_api_key: '',
  ui_accent_color: 'vnite',
  ui_theme_mode: 'dark',
  privacy_hide_hidden: false,
  privacy_blur_covers: false,
  privacy_filter_reports: true,
  database_auto_backup_on_startup: true,
  save_auto_backup_before_launch: false,
  save_auto_backup_after_exit: false,
  tray_enabled: true,
};

export function settingsRecordToForm(settings: Record<string, string>): SettingsForm {
  return {
    provider_vndb_enabled: settings.provider_vndb_enabled !== 'false',
    provider_bangumi_enabled: settings.provider_bangumi_enabled !== 'false',
    provider_dlsite_enabled: settings.provider_dlsite_enabled !== 'false',
    provider_fanza_enabled: settings.provider_fanza_enabled !== 'false',
    provider_ymgal_enabled: settings.provider_ymgal_enabled !== 'false',
    ai_base_url: settings.ai_base_url ?? '',
    ai_model: settings.ai_model ?? 'gpt-4o-mini',
    ai_api_key: settings.ai_api_key ?? '',
    ui_accent_color: settings.ui_accent_color ?? 'vnite',
    ui_theme_mode: settings.ui_theme_mode ?? 'dark',
    privacy_hide_hidden: settings.privacy_hide_hidden === 'true',
    privacy_blur_covers: settings.privacy_blur_covers === 'true',
    privacy_filter_reports: settings.privacy_filter_reports !== 'false',
    database_auto_backup_on_startup: settings.database_auto_backup_on_startup !== 'false',
    save_auto_backup_before_launch: settings.save_auto_backup_before_launch === 'true',
    save_auto_backup_after_exit: settings.save_auto_backup_after_exit === 'true',
    tray_enabled: settings.tray_enabled !== 'false',
  };
}

export function settingsFormToRecord(form: SettingsForm): Record<string, string> {
  return {
    provider_vndb_enabled: String(form.provider_vndb_enabled),
    provider_bangumi_enabled: String(form.provider_bangumi_enabled),
    provider_dlsite_enabled: String(form.provider_dlsite_enabled),
    provider_fanza_enabled: String(form.provider_fanza_enabled),
    provider_ymgal_enabled: String(form.provider_ymgal_enabled),
    ai_base_url: form.ai_base_url,
    ai_model: form.ai_model,
    ai_api_key: form.ai_api_key,
    ui_accent_color: form.ui_accent_color,
    ui_theme_mode: form.ui_theme_mode,
    ui_vnite_theme_migrated: 'true',
    privacy_hide_hidden: String(form.privacy_hide_hidden),
    privacy_blur_covers: String(form.privacy_blur_covers),
    privacy_filter_reports: String(form.privacy_filter_reports),
    database_auto_backup_on_startup: String(form.database_auto_backup_on_startup),
    save_auto_backup_before_launch: String(form.save_auto_backup_before_launch),
    save_auto_backup_after_exit: String(form.save_auto_backup_after_exit),
    tray_enabled: String(form.tray_enabled),
  };
}

export function settingsFormToAiConnectionRecord(form: SettingsForm): Record<string, string> {
  return {
    ai_base_url: form.ai_base_url,
    ai_model: form.ai_model,
    ai_api_key: form.ai_api_key,
  };
}
