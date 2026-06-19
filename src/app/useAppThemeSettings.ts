import { useCallback, useEffect, useState } from 'react';
import { api } from '@/services/api';

type ThemeMode = 'dark' | 'light' | 'system';

export type AppAccentTheme = {
  rgb: string;
  strongRgb: string;
  contrast: string;
};

export function useAppThemeSettings(refreshKey: number) {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => typeof window === 'undefined' ? true : window.matchMedia('(prefers-color-scheme: dark)').matches);
  const accentId = settings.ui_accent_color ?? 'vnite';
  const accent = accentThemes[accentId] ?? accentThemes.vnite;
  const themeMode = (settings.ui_theme_mode === 'light' || settings.ui_theme_mode === 'system' ? settings.ui_theme_mode : 'dark') satisfies ThemeMode;
  const resolvedTheme: 'dark' | 'light' = themeMode === 'system' ? (systemPrefersDark ? 'dark' : 'light') : themeMode;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemPrefersDark(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => {
    api.getAppSettings()
      .then(async (next) => {
        const shouldMigrateToVnite = next.ui_vnite_theme_migrated !== 'true';
        if (!shouldMigrateToVnite) {
          setSettings(next);
          return;
        }

        const migrated = { ...next, ui_accent_color: 'vnite', ui_vnite_theme_migrated: 'true' };
        setSettings(migrated);
        await api.setAppSettings(migrated);
      })
      .catch(() => setSettings({ ui_accent_color: 'vnite', ui_theme_mode: 'dark' }));
  }, [refreshKey]);

  const previewAccent = useCallback((uiAccentColor: string) => {
    setSettings((current) => ({ ...current, ui_accent_color: uiAccentColor, ui_vnite_theme_migrated: 'true' }));
  }, []);

  const previewTheme = useCallback((uiThemeMode: string) => {
    setSettings((current) => ({ ...current, ui_theme_mode: uiThemeMode }));
  }, []);

  const toggleTheme = useCallback(() => {
    const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    const nextSettings = { ...settings, ui_theme_mode: nextTheme, ui_vnite_theme_migrated: 'true' };
    setSettings(nextSettings);
    void api.setAppSettings(nextSettings).catch(() => undefined);
  }, [resolvedTheme, settings]);

  return {
    accent,
    previewAccent,
    previewTheme,
    resolvedTheme,
    toggleTheme,
  };
}

const accentThemes: Record<string, AppAccentTheme> = {
  vnite: { rgb: '91 118 183', strongRgb: '74 101 168', contrast: '#f8fbff' },
  rose: { rgb: '251 113 133', strongRgb: '244 63 94', contrast: '#fff7f8' },
  teal: { rgb: '94 234 212', strongRgb: '45 212 191', contrast: '#020617' },
  blue: { rgb: '125 211 252', strongRgb: '56 189 248', contrast: '#020617' },
  amber: { rgb: '252 211 77', strongRgb: '245 158 11', contrast: '#17130a' },
};
