import { AlertTriangle, Copy, FolderOpen, FolderSync, ListTodo } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { SoftRow } from '@/components/ui/page';
import type { Game, GamePathHealth } from '@/types/game';
import { formatDateTime } from '@/utils/time';
import { PathRow, Section } from './GameDetailParts';

type GamePathPanelProps = {
  game: Game;
  pathHealth: GamePathHealth | null;
  onCheckPaths: () => void | Promise<void>;
  onCheckPathsInBackground: () => void | Promise<void>;
  onCopyPath: (label: string, path?: string | null) => void | Promise<void>;
  onOpenTasks?: (taskId?: string | null) => void;
  onRelocate: () => void | Promise<void>;
  onRevealPath: (path?: string | null) => void | Promise<void>;
};

export function GamePathPanel({
  game,
  pathHealth,
  onCheckPaths,
  onCheckPathsInBackground,
  onCopyPath,
  onOpenTasks,
  onRelocate,
  onRevealPath,
}: GamePathPanelProps) {
  const currentStatus = pathHealth?.status ?? game.pathStatus;

  return (
    <Section title="本地路径">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge>{pathStatusLabel(currentStatus)}</Badge>
        {game.lastPathCheckedAt && <span className="text-xs text-slate-500">上次检查 {formatDateTime(game.lastPathCheckedAt)}</span>}
        <Button size="sm" variant="outline" onClick={onCheckPaths}><FolderSync className="h-4 w-4" />检查路径</Button>
        <Button size="sm" variant="outline" onClick={onCheckPathsInBackground}>后台检查</Button>
        <Button size="sm" variant="outline" onClick={() => void onRevealPath(game.installPath)}><FolderOpen className="h-4 w-4" />打开目录</Button>
        <Button size="sm" variant="secondary" onClick={onRelocate}>重定位安装目录</Button>
        {onOpenTasks && <Button size="sm" variant="ghost" onClick={() => onOpenTasks()}><ListTodo className="h-4 w-4" />任务页</Button>}
      </div>
      {currentStatus === 'broken' && (
        <Notice className="mb-3 text-xs" tone="warning">
          <span className="inline-flex items-center gap-2"><AlertTriangle className="h-3.5 w-3.5" />检测到路径异常。可以先重定位安装目录，应用会同步更新同前缀的启动程序、工作目录和启动配置。</span>
        </Notice>
      )}
      {currentStatus === 'incomplete' && (
        <Notice className="mb-3 text-xs" tone="warning">
          有部分路径尚未配置。游戏仍可保留在库中，补齐启动程序或工作目录后再检查即可。
        </Notice>
      )}
      {pathHealth && (
        <div className="mb-3 space-y-2">
          {pathHealth.items.map((item) => (
            <SoftRow className="grid gap-2 px-3 py-2 lg:grid-cols-[6rem_5rem_minmax(0,1fr)_auto]" key={item.kind}>
              <span className="text-slate-500">{item.label}</span>
              <Badge>{pathItemLabel(item.status)}</Badge>
              <span className="break-all font-mono text-xs text-slate-300">{item.path || item.message || '未配置'}</span>
              {item.path ? <Button aria-label={`复制路径检查${item.label}`} size="sm" variant="ghost" onClick={() => void onCopyPath(`路径检查${item.label}`, item.path)}><Copy className="h-4 w-4" />复制</Button> : <span />}
            </SoftRow>
          ))}
        </div>
      )}
      <dl className="space-y-2 text-sm">
        <PathRow label="安装目录" value={game.installPath} onCopy={() => void onCopyPath('安装目录', game.installPath)} onReveal={() => void onRevealPath(game.installPath)} />
        <PathRow label="启动程序" value={game.executablePath || '未选择'} onCopy={game.executablePath ? () => void onCopyPath('启动程序', game.executablePath) : undefined} onReveal={game.executablePath ? () => void onRevealPath(game.executablePath) : undefined} />
        <PathRow label="工作目录" value={game.workingDirectory || '默认安装目录'} onCopy={game.workingDirectory ? () => void onCopyPath('工作目录', game.workingDirectory) : undefined} onReveal={game.workingDirectory ? () => void onRevealPath(game.workingDirectory) : undefined} />
        <PathRow label="启动参数" value={game.launchArgs || '无'} />
      </dl>
    </Section>
  );
}

export function pathHealthMessage(status: string) {
  if (status === 'ok') return '路径检查完成，所有关键路径可用。';
  if (status === 'incomplete') return '路径检查完成，有部分路径尚未配置。';
  if (status === 'broken') return '路径检查完成，发现不可用路径。';
  return '路径检查完成。';
}

export function pathStatusLabel(status: string) {
  const labels: Record<string, string> = {
    unknown: '未检查',
    ok: '路径正常',
    incomplete: '路径不完整',
    broken: '路径异常',
  };
  return labels[status] ?? status;
}

function pathItemLabel(status: string) {
  const labels: Record<string, string> = {
    ok: '正常',
    missing: '不存在',
    wrong_type: '类型不符',
    not_configured: '未配置',
  };
  return labels[status] ?? status;
}
