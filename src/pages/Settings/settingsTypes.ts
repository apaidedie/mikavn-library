export type SettingsTab = 'appearance' | 'sources' | 'local';

export type SettingsForm = {
  provider_vndb_enabled: boolean;
  provider_bangumi_enabled: boolean;
  provider_dlsite_enabled: boolean;
  provider_fanza_enabled: boolean;
  provider_ymgal_enabled: boolean;
  ai_base_url: string;
  ai_model: string;
  ai_api_key: string;
  ui_accent_color: string;
  ui_theme_mode: string;
  privacy_hide_hidden: boolean;
  privacy_blur_covers: boolean;
  privacy_filter_reports: boolean;
  save_auto_backup_before_launch: boolean;
  save_auto_backup_after_exit: boolean;
  tray_enabled: boolean;
};
