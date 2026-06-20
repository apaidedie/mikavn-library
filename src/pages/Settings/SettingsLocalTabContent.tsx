import type { SettingsForm } from './settingsTypes';
import { SettingsDiagnosticLogsSection } from './SettingsDiagnosticLogsSection';
import { SettingsLibraryRootsSection } from './SettingsLibraryRootsSection';
import { SettingsLocalDataSection } from './SettingsLocalDataSection';
import { SettingsLocalPreferencesSection } from './SettingsLocalPreferencesSection';
import { SettingsTagMaintenanceSection } from './SettingsTagMaintenanceSection';
import { SettingsTraySection } from './SettingsTraySection';
import { SettingsUpdateSection } from './SettingsUpdateSection';
import type { useSettingsLibraryRoots } from './useSettingsLibraryRoots';
import type { useSettingsLocalDataActions } from './useSettingsLocalDataActions';
import type { useSettingsPageActions } from './useSettingsPageActions';

type SettingsLocalTabContentProps = {
  form: SettingsForm;
  libraryRoots: ReturnType<typeof useSettingsLibraryRoots>;
  localData: ReturnType<typeof useSettingsLocalDataActions>;
  settings: ReturnType<typeof useSettingsPageActions>;
};

export function SettingsLocalTabContent({ form, libraryRoots, localData, settings }: SettingsLocalTabContentProps) {
  const actions = settings.actions;
  const scrollToDatabaseRestore = () => {
    document.getElementById('database-restore-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <>
      <SettingsLibraryRootsSection
        libraryRootPath={libraryRoots.libraryRootPath}
        libraryRoots={libraryRoots.libraryRoots}
        rootActionId={libraryRoots.rootActionId}
        onAddLibraryRoot={libraryRoots.addLibraryRoot}
        onCopyDirectoryPath={localData.copyDirectoryPath}
        onLibraryRootPathChange={libraryRoots.setLibraryRootPath}
        onPickLibraryRoot={libraryRoots.pickLibraryRoot}
        onRemoveLibraryRoot={libraryRoots.removeLibraryRoot}
        onScanLibraryRoot={libraryRoots.scanLibraryRoot}
        onUpdateLibraryRoot={libraryRoots.updateLibraryRoot}
      />

      <SettingsUpdateSection
        onOpenDatabaseRestore={scrollToDatabaseRestore}
        onRevealBackup={(path) => void localData.revealPath('更新前数据库备份', path)}
      />

      <SettingsLocalDataSection
        archiveDir={localData.archiveDir}
        archivePreview={localData.archivePreview}
        cleanupLoading={localData.cleanupLoading}
        databasePath={localData.databasePath}
        diagnostics={localData.diagnostics}
        diagnosticsLoading={localData.diagnosticsLoading}
        directoryLocations={localData.directoryLocations}
        includeImages={localData.includeImages}
        includeSaveBackups={localData.includeSaveBackups}
        onArchiveDirChange={localData.setArchiveDir}
        onBackupDatabase={localData.backupDatabase}
        onCleanupDatabaseBackups={localData.cleanupDatabaseBackups}
        onCopyAllDirectoryPaths={localData.copyAllDirectoryPaths}
        onCopyDirectoryPath={localData.copyDirectoryPath}
        onExportArchive={localData.exportArchive}
        onExportArchiveZip={localData.exportArchiveZip}
        onImportArchive={localData.importArchive}
        onIncludeImagesChange={localData.setIncludeImages}
        onIncludeSaveBackupsChange={localData.setIncludeSaveBackups}
        onLoadDiagnostics={localData.loadDiagnostics}
        onPickArchiveDir={localData.pickArchiveDir}
        onPickArchivePath={localData.pickArchivePath}
        onPreviewArchive={localData.previewArchive}
        onRestoreArchive={localData.restoreArchive}
        onRestoreDatabase={localData.restoreDatabase}
        onRevealPath={localData.revealPath}
      />

      <SettingsTraySection form={form} savedTrayEnabled={settings.savedTrayEnabled} trayStatus={settings.trayStatus} onFormChange={actions.updateForm} />

      <SettingsDiagnosticLogsSection
        logs={settings.logs}
        onCopyLogPath={(path) => void localData.copyDirectoryPath('诊断日志', path)}
        onLoadLogs={actions.loadLogs}
        onPruneLogs={actions.pruneLogs}
        onRevealLogPath={(path) => void localData.revealPath('诊断日志', path)}
      />

      <SettingsTagMaintenanceSection
        mergeSourceIds={settings.mergeSourceIds}
        renameTagName={settings.renameTagName}
        selectedTagId={settings.selectedTagId}
        tags={settings.tags}
        onDeleteSelectedTag={actions.deleteSelectedTag}
        onLoadTags={actions.loadTags}
        onMergeSelectedTags={actions.mergeSelectedTags}
        onRenameSelectedTag={actions.renameSelectedTag}
        onRenameTagNameChange={actions.setRenameTagName}
        onSelectTag={actions.selectTag}
        onToggleMergeSource={actions.toggleMergeSource}
      />

      <SettingsLocalPreferencesSection form={form} onFormChange={actions.updateForm} />
    </>
  );
}
