import { useAppNavigationController } from './useAppNavigationController';
import { useAppThemeSettings } from './useAppThemeSettings';
import { useStartupDatabaseBackup } from './useStartupDatabaseBackup';
import { useStartupDatabaseBackupDiagnosticExport } from './useStartupDatabaseBackupDiagnosticExport';
import { useStartupSelfCheck } from './useStartupSelfCheck';
import { useStartupUpdater } from './useStartupUpdater';

export function useAppController() {
  const navigation = useAppNavigationController();
  const { accent, previewAccent, previewTheme, resolvedTheme, toggleTheme } = useAppThemeSettings(navigation.refreshKey);
  const startupDatabaseBackup = useStartupDatabaseBackup();
  const startupDatabaseBackupDiagnosticExport = useStartupDatabaseBackupDiagnosticExport();
  const startupSelfCheck = useStartupSelfCheck();
  const startupUpdater = useStartupUpdater();
  const startupUpdateNotice = startupUpdater.notice?.kind === 'available' ? startupUpdater.notice : null;

  return {
    accent,
    previewAccent,
    previewTheme,
    resolvedTheme,
    startupUpdateNotice,
    startupDatabaseBackup,
    ...startupDatabaseBackupDiagnosticExport,
    ...startupSelfCheck,
    startupUpdater,
    toggleTheme,
    ...navigation,
  };
}
