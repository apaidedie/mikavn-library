import { Download, FolderOpen, RefreshCw, RotateCcw, RotateCw } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfigItem, ConfigSection } from '@/components/ui/config-item';
import { checkForAppUpdate, installAppUpdate, restartAfterUpdate, type AppUpdateHandle } from '@/services/updater';
import { formatUpdaterError, formatUpdaterInstallProgress, type UpdaterCheckResult } from '@/services/updaterModel';

type InstallState = 'idle' | 'checking' | 'available' | 'up_to_date' | 'installing' | 'installed' | 'failed' | 'unavailable';

type SettingsUpdateSectionProps = {
  onOpenDatabaseRestore?: () => void;
  onRevealBackup?: (path: string) => void | Promise<void>;
};

export function SettingsUpdateSection({ onOpenDatabaseRestore, onRevealBackup }: SettingsUpdateSectionProps) {
  const [state, setState] = useState<InstallState>('idle');
  const [result, setResult] = useState<UpdaterCheckResult | null>(null);
  const [update, setUpdate] = useState<AppUpdateHandle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [backupInfo, setBackupInfo] = useState<{ fileName: string; path: string } | null>(null);
  const [installProgress, setInstallProgress] = useState<string | null>(null);

  const checkUpdates = async () => {
    setState('checking');
    setError(null);
    setBackupInfo(null);
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
    setState('installing');
    setError(null);
    setBackupInfo(null);
    setInstallProgress(null);
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
      setError(installResult.message);
    }
  };

  return (
    <ConfigSection title="应用更新">
      <ConfigItem title="Windows 更新" description="通过公开 GitHub Releases 检查并安装已签名的 Windows 更新。">
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
                <Button size="sm" type="button" variant="outline" onClick={() => void onOpenDatabaseRestore?.()}><RotateCcw className="h-4 w-4" />去恢复数据库</Button>
              </div>
            </div>
          )}
          {result?.kind === 'available' && <div className="max-w-[42rem] text-right text-xs text-slate-400">发布说明：{result.notes}</div>}
          {result?.kind === 'unavailable' && <div className="max-w-[42rem] text-right text-xs text-amber-200">浏览器预览不会下载或安装更新。</div>}
          {error && <textarea className="min-h-16 w-[min(42rem,calc(100vw-3rem))] rounded-md bg-black/30 p-2 text-xs text-rose-100" readOnly value={error} />}
          <div className="flex flex-wrap justify-end gap-2">
            <Button disabled={state !== 'available'} onClick={() => void installUpdate()} type="button" variant="secondary">
              <Download className="h-4 w-4" />
              下载并安装
            </Button>
            <Button disabled={state !== 'installed'} onClick={() => void restartAfterUpdate()} type="button" variant="secondary">
              <RotateCw className="h-4 w-4" />
              重启应用
            </Button>
          </div>
        </div>
      </ConfigItem>
    </ConfigSection>
  );
}
