import { Copy, FileText, FolderOpen, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfigItem, ConfigSection } from '@/components/ui/config-item';
import type { LogRecord } from '@/types/archive';

export function SettingsDiagnosticLogsSection({
  logs,
  onCopyLogPath,
  onLoadLogs,
  onPruneLogs,
  onRevealLogPath,
}: {
  logs: LogRecord[];
  onCopyLogPath: (path: string) => void;
  onLoadLogs: () => void;
  onPruneLogs: () => void;
  onRevealLogPath: (path: string) => void;
}) {
  return (
    <ConfigSection title="诊断日志">
      <ConfigItem title="本地日志" description="只显示已脱敏的本机日志预览，用于排查扫描、备份和启动问题。">
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onLoadLogs}><FileText className="h-4 w-4" />刷新</Button>
          <Button variant="ghost" onClick={onPruneLogs}><Trash2 className="h-4 w-4" />清理</Button>
        </div>
      </ConfigItem>
      <ConfigItem title="最近日志" description="默认保留 30 天 / 60 个文件，可通过清理按钮执行保留策略。">
        <div className="w-full max-w-[42rem] space-y-2 text-left">
          {logs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/10 bg-black/[0.10] px-3 py-4 text-right text-xs text-slate-500">还没有诊断日志。</div>
          ) : logs.slice(0, 4).map((log) => (
            <div className="rounded-lg border border-white/10 bg-black/[0.12] p-3" key={log.path}>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-mono text-slate-300">{log.fileName}</span>
                <span className="text-slate-500">{Math.ceil(log.sizeBytes / 1024)} KB</span>
              </div>
              <div className="mt-2 flex flex-wrap items-start justify-between gap-2 rounded-md border border-white/10 bg-black/[0.10] px-2 py-1.5">
                <div className="min-w-0 break-all font-mono text-[11px] text-slate-500">{log.path}</div>
                <div className="flex shrink-0 gap-1">
                  <Button aria-label={`复制诊断日志 ${log.fileName}`} className="h-7 px-2" size="sm" variant="ghost" onClick={() => onCopyLogPath(log.path)}><Copy className="h-4 w-4" />复制</Button>
                  <Button aria-label={`打开诊断日志 ${log.fileName}`} className="h-7 px-2" size="sm" variant="ghost" onClick={() => onRevealLogPath(log.path)}><FolderOpen className="h-4 w-4" />打开</Button>
                </div>
              </div>
              {log.preview.slice(-2).map((line) => <div className="mt-1 break-all font-mono text-[11px] text-slate-500" key={line}>{line}</div>)}
            </div>
          ))}
        </div>
      </ConfigItem>
    </ConfigSection>
  );
}
