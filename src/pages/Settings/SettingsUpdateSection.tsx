import { ClipboardCopy, Download, ExternalLink, FileArchive, FolderOpen, RefreshCw, RotateCcw, RotateCw } from 'lucide-react';
import { useRef, useState } from 'react';
import { DiagnosticExportPathActions } from '@/components/diagnostics/DiagnosticExportPathActions';
import { Button } from '@/components/ui/button';
import { ConfigItem, ConfigSection } from '@/components/ui/config-item';
import { checkForAppUpdate, installAppUpdate, restartAfterUpdate, type AppUpdateHandle } from '@/services/updater';
import { createUpdaterRecoveryHint, formatUpdaterError, formatUpdaterInstallProgress, updaterFallbackDownloadUrl, type UpdaterCheckResult } from '@/services/updaterModel';

type InstallState = 'idle' | 'checking' | 'available' | 'up_to_date' | 'installing' | 'installed' | 'failed' | 'unavailable';

type SettingsUpdateSectionProps = {
  diagnosticExportLoading?: boolean;
  diagnosticExportMessage?: string | null;
  diagnosticExportPath?: string | null;
  onCopyDiagnosticExportPath?: () => void;
  onExportDiagnosticPackage?: () => void;
  onOpenDatabaseRestore?: () => void;
  onRevealDiagnosticExportPath?: () => void;
  onRevealBackup?: (path: string) => void | Promise<void>;
};

export function SettingsUpdateSection({
  diagnosticExportLoading = false,
  diagnosticExportMessage,
  diagnosticExportPath,
  onCopyDiagnosticExportPath,
  onExportDiagnosticPackage,
  onOpenDatabaseRestore,
  onRevealDiagnosticExportPath,
  onRevealBackup,
}: SettingsUpdateSectionProps) {
  const [state, setState] = useState<InstallState>('idle');
  const [result, setResult] = useState<UpdaterCheckResult | null>(null);
  const [update, setUpdate] = useState<AppUpdateHandle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [backupInfo, setBackupInfo] = useState<{ fileName: string; path: string } | null>(null);
  const [backupActionMessage, setBackupActionMessage] = useState<string | null>(null);
  const [recoveryActionMessage, setRecoveryActionMessage] = useState<string | null>(null);
  const [installProgress, setInstallProgress] = useState<string | null>(null);
  const installInFlightRef = useRef(false);
  const recoveryHint = createUpdaterRecoveryHint(error);

  const checkUpdates = async () => {
    setState('checking');
    setError(null);
    setBackupInfo(null);
    setBackupActionMessage(null);
    setRecoveryActionMessage(null);
    setInstallProgress(null);
    try {
      const response = await checkForAppUpdate();
      setResult(response.result);
      setUpdate(response.update);
      setState(response.result.kind);
    } catch (error) {
      setResult(null);
      setUpdate(null);
      setError(formatUpdaterError(error));
      setState('failed');
    }
  };

  const installUpdate = async () => {
    if (installInFlightRef.current || state !== 'available' || !update) return;
    installInFlightRef.current = true;
    setState('installing');
    setError(null);
    setBackupInfo(null);
    setBackupActionMessage(null);
    setRecoveryActionMessage(null);
    setInstallProgress(null);
    try {
      const installResult = await installAppUpdate(update, (progress) => setInstallProgress(formatUpdaterInstallProgress(progress)));
      if (installResult.kind === 'installed') {
        setBackupInfo(installResult.backup ? { fileName: installResult.backup.fileName, path: installResult.backup.path } : null);
        setInstallProgress(null);
        setState('installed');
        setResult({
          kind: 'available',
          version: result?.kind === 'available' ? result.version : '新版本',
          notes: result?.kind === 'available' ? result.notes : '更新已安装。',
          message: installResult.message,
        });
      } else {
        setState('failed');
        setInstallProgress(null);
        setBackupInfo(installResult.backup ? { fileName: installResult.backup.fileName, path: installResult.backup.path } : null);
        setError(installResult.message);
      }
    } catch (error) {
      setState('failed');
      setInstallProgress(null);
      setBackupInfo(null);
      setError(formatUpdaterError(error));
    } finally {
      installInFlightRef.current = false;
    }
  };

  const restartUpdate = async () => {
    setError(null);
    try {
      await restartAfterUpdate();
    } catch (error) {
      setError(`重启应用失败：${formatUpdaterError(error).replace(/^更新失败：/, '')}`);
    }
  };

  const copyBackupPath = async () => {
    if (!backupInfo) return;
    setError(null);
    setBackupActionMessage(null);
    setRecoveryActionMessage(null);
    try {
      await navigator.clipboard.writeText(backupInfo.path);
      setBackupActionMessage('已复制更新前数据库备份路径。');
    } catch (error) {
      setError(`复制备份路径失败：${formatUpdaterError(error).replace(/^更新失败：/, '')}`);
    }
  };

  const copyUpdateRecoveryText = async (text: string, successMessage: string) => {
    setRecoveryActionMessage(null);
    try {
      await navigator.clipboard.writeText(text);
      setRecoveryActionMessage(successMessage);
    } catch (error) {
      setRecoveryActionMessage(`复制失败：${formatUpdaterError(error).replace(/^更新失败：/, '')}`);
    }
  };

  return (
    <ConfigSection title="应用更新">
      <ConfigItem title="Windows 更新" description="通过公开 GitHub Releases 检查 Windows 更新；安装前会自动备份数据库，失败时提供备用下载链接。">
        <div className="flex flex-col items-end gap-3">
          <Button disabled={state === 'checking' || state === 'installing'} onClick={() => void checkUpdates()} type="button" variant="outline">
            <RefreshCw className="h-4 w-4" />
            {state === 'checking' ? '检查中' : '检查更新'}
          </Button>
          <div className="max-w-[42rem] text-right text-sm text-slate-300">{result?.message ?? '尚未检查更新。'}</div>
          <div className="max-w-[42rem] text-right text-xs text-slate-400">下载并安装前会自动创建更新前数据库备份；备份失败会取消安装。</div>
          {state === 'installing' && <div className="max-w-[42rem] text-right text-xs text-amber-200">{installProgress ?? '备份中，然后下载并安装更新。'}</div>}
          {backupInfo && (
            <div className="flex max-w-[42rem] flex-col items-end gap-2 text-right">
              <div className="break-all text-xs text-emerald-200">更新前数据库备份：{backupInfo.fileName}</div>
              <div className="text-xs text-slate-500">如果更新后数据异常，可以从本地数据页安排恢复；恢复前会再次创建保护备份。</div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button size="sm" type="button" variant="ghost" onClick={() => void onRevealBackup?.(backupInfo.path)}><FolderOpen className="h-4 w-4" />打开备份位置</Button>
                <Button size="sm" type="button" variant="ghost" onClick={() => void copyBackupPath()}><ClipboardCopy className="h-4 w-4" />复制备份路径</Button>
                <Button size="sm" type="button" variant="outline" onClick={() => void onOpenDatabaseRestore?.()}><RotateCcw className="h-4 w-4" />去恢复数据库</Button>
              </div>
              {backupActionMessage && <div className="text-xs text-emerald-200">{backupActionMessage}</div>}
            </div>
          )}
          {result?.kind === 'available' && <div className="max-w-[42rem] text-right text-xs text-slate-400">发布说明：{result.notes}</div>}
          {result?.kind === 'unavailable' && <div className="max-w-[42rem] text-right text-xs text-amber-200">浏览器预览不会下载或安装更新。</div>}
          {error && (
            <div className="flex max-w-[42rem] flex-col items-end gap-2">
              {recoveryHint && (
                <div className="max-w-[42rem] rounded-md border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-right">
                  <div className="text-xs font-medium text-amber-100">{recoveryHint?.title}</div>
                  <div className="mt-1 text-xs text-slate-300">{recoveryHint?.guidance}</div>
                </div>
              )}
              <textarea className="min-h-16 w-[min(42rem,calc(100vw-3rem))] rounded-md bg-black/30 p-2 text-xs text-rose-100" readOnly value={error} />
              <div className="flex flex-wrap justify-end gap-2">
                <Button size="sm" type="button" variant="ghost" onClick={() => void copyUpdateRecoveryText(error, '已复制更新错误。')}>
                  <ClipboardCopy className="h-4 w-4" />
                  复制错误
                </Button>
                {recoveryHint?.showFallbackDownload && (
                  <>
                    <Button size="sm" type="button" variant="ghost" onClick={() => void copyUpdateRecoveryText(updaterFallbackDownloadUrl, '已复制备用下载链接。')}>
                      <ClipboardCopy className="h-4 w-4" />
                      复制备用链接
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <a href={updaterFallbackDownloadUrl} rel="noreferrer" target="_blank">
                        <ExternalLink className="h-4 w-4" />
                        备用下载页面
                      </a>
                    </Button>
                  </>
                )}
                {onExportDiagnosticPackage && (
                  <Button disabled={diagnosticExportLoading} size="sm" type="button" variant="outline" onClick={onExportDiagnosticPackage}>
                    <FileArchive className="h-4 w-4" />
                    {diagnosticExportLoading ? '导出中' : '导出诊断包'}
                  </Button>
                )}
              </div>
              {recoveryActionMessage && <div className="text-xs text-emerald-200">{recoveryActionMessage}</div>}
              {diagnosticExportMessage && <div className="max-w-[42rem] break-all text-right text-xs text-emerald-200">{diagnosticExportMessage}</div>}
              {diagnosticExportPath && onCopyDiagnosticExportPath && onRevealDiagnosticExportPath && (
                <div className="flex flex-wrap justify-end gap-2">
                  <DiagnosticExportPathActions
                    buttonSize="sm"
                    buttonVariant="ghost"
                    path={diagnosticExportPath}
                    onCopy={onCopyDiagnosticExportPath}
                    onReveal={onRevealDiagnosticExportPath}
                  />
                </div>
              )}
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button disabled={state !== 'available'} onClick={() => void installUpdate()} type="button" variant="secondary">
              <Download className="h-4 w-4" />
              下载并安装
            </Button>
            <Button disabled={state !== 'installed'} onClick={() => void restartUpdate()} type="button" variant="secondary">
              <RotateCw className="h-4 w-4" />
              重启应用
            </Button>
            <Button asChild type="button" variant="outline">
              <a href={updaterFallbackDownloadUrl} rel="noreferrer" target="_blank">
                <ExternalLink className="h-4 w-4" />
                手动下载最新版
              </a>
            </Button>
          </div>
        </div>
      </ConfigItem>
    </ConfigSection>
  );
}
