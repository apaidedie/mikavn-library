import { AppChrome } from './AppChrome';
import { AppRoutes } from './AppRoutes';
import { AppStartupDatabaseBackupNotice } from './AppStartupDatabaseBackupNotice';
import { AppUpdateNotice } from './AppUpdateNotice';
import { useAppController } from './useAppController';

export function App() {
  const app = useAppController();

  return (
    <AppChrome
      accent={app.accent}
      librarySearchValue={app.librarySearchValue}
      onFocusLibrarySearch={app.focusLibrarySearch}
      onRefresh={app.refresh}
      onRequestAddGame={app.requestAddGame}
      onSetView={app.setView}
      onToggleLibraryFilters={app.toggleLibraryFilters}
      onToggleTheme={app.toggleTheme}
      onUpdateLibrarySearch={app.updateLibrarySearch}
      resolvedTheme={app.resolvedTheme}
      title={app.title}
      topSearchRef={app.topSearchRef}
      view={app.view}
    >
      {app.startupDatabaseBackup.startupDatabaseBackupError && (
        <AppStartupDatabaseBackupNotice
          error={app.startupDatabaseBackup.startupDatabaseBackupError}
          onDismiss={app.startupDatabaseBackup.dismissStartupDatabaseBackupError}
          onOpenSettings={() => app.openSettings('local')}
        />
      )}

      {app.startupUpdateNotice && (
        <AppUpdateNotice
          backupActionMessage={app.startupUpdater.backupActionMessage}
          backupInfo={app.startupUpdater.backupInfo}
          error={app.startupUpdater.error}
          installed={app.startupUpdater.installed}
          installing={app.startupUpdater.installing}
          notice={app.startupUpdateNotice}
          progressText={app.startupUpdater.installProgress}
          onCopyBackupPath={app.startupUpdater.copyStartupBackupPath}
          onDismiss={app.startupUpdater.dismissStartupUpdate}
          onInstall={app.startupUpdater.installStartupUpdate}
          onRevealBackup={app.startupUpdater.revealStartupBackupPath}
          onRestart={app.startupUpdater.restartStartupUpdate}
        />
      )}

      <AppRoutes
        addRequestKey={app.addRequestKey}
        filterToggleKey={app.libraryFilterToggleKey}
        libraryFilterPresetRequest={app.libraryFilterPresetRequest}
        librarySearchValue={app.librarySearchValue}
        maintenanceFocusRequest={app.maintenanceFocusRequest}
        metadataQueuePresetRequest={app.metadataQueuePresetRequest}
        onAccentPreview={app.previewAccent}
        onAddGame={app.requestAddGame}
        onAddRequestConsumed={app.consumeAddRequest}
        onChanged={app.refresh}
        onOpenGame={app.openGame}
        onOpenLibrary={app.openLibrary}
        onOpenMaintenance={app.openMaintenance}
        onOpenMetadata={app.openMetadata}
        onOpenSaves={app.openSaves}
        onOpenScanner={app.openScanner}
        onOpenSettings={app.openSettings}
        onOpenTasks={app.openTasks}
        onThemePreview={app.previewTheme}
        refreshKey={app.refreshKey}
        selectedGameId={app.selectedGameId}
        setSelectedGameId={app.setSelectedGameId}
        settingsTabRequest={app.settingsTabRequest}
        taskFilterPresetRequest={app.taskFilterPresetRequest}
        taskFocusRequest={app.taskFocusRequest}
        view={app.view}
      />
    </AppChrome>
  );
}
