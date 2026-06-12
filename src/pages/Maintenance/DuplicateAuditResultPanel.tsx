import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SoftRow } from '@/components/ui/page';
import type { TaskDetail, TaskLogEntry, TaskRecord } from '@/types/task';
import { taskStatusClass, taskStatusLabel } from '@/utils/taskLabels';
import { formatDateTime } from '@/utils/time';

export type DuplicateAuditGroupSummary = {
  provider: string;
  externalId: string;
  gameCount: number;
  games: Array<{ title: string; gameId: string }>;
};
export type DuplicateAuditTaskSummary = {
  task: TaskRecord;
  groups: DuplicateAuditGroupSummary[];
};

export function DuplicateAuditTaskRow({ summary, onOpenTask }: { summary: DuplicateAuditTaskSummary; onOpenTask?: (taskId?: string | null) => void }) {
  const task = summary.task;
  const visibleGroups = summary.groups.slice(0, 6);
  const hiddenCount = summary.groups.length - visibleGroups.length;

  return (
    <SoftRow className="space-y-3 px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-slate-100">{task.message || '重复 ID 审查任务'}</span>
            <Badge className={taskStatusClass(task.status)}>{taskStatusLabel(task.status)}</Badge>
          </div>
          <div className="mt-1 text-xs text-slate-500">更新于 {formatDateTime(task.updatedAt)}</div>
          {task.error && <div className="mt-2 break-all text-xs text-rose-200">{task.error}</div>}
        </div>
        {onOpenTask && <Button size="sm" variant="ghost" onClick={() => onOpenTask(task.id)}>日志</Button>}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <DuplicateCompactStat label="重复组" value={summary.groups.length} tone={summary.groups.length > 0 ? 'warn' : 'ok'} />
        <DuplicateCompactStat label="涉及游戏" value={summary.groups.reduce((count, group) => count + group.gameCount, 0)} tone={summary.groups.length > 0 ? 'warn' : 'neutral'} />
        <DuplicateCompactStat label="来源数" value={new Set(summary.groups.map((group) => group.provider)).size} />
      </div>
      {visibleGroups.length > 0 ? (
        <div className="space-y-2">
          {visibleGroups.map((group) => <DuplicateAuditGroupRow group={group} key={`${group.provider}:${group.externalId}`} />)}
          {hiddenCount > 0 && <div className="px-1 text-xs text-slate-500">还有 {formatCount(hiddenCount)} 个重复组，可打开日志查看完整记录。</div>}
        </div>
      ) : (
        <div className="text-xs text-slate-500">这条任务没有可解析的重复组明细。</div>
      )}
    </SoftRow>
  );
}

export function summarizeDuplicateAuditTask(detail: TaskDetail): DuplicateAuditTaskSummary {
  return {
    task: detail.task,
    groups: detail.logs.flatMap(parseDuplicateAuditLog),
  };
}

export function filterDuplicateAuditSummary(summary: DuplicateAuditTaskSummary, query: string, providerFilter: string): DuplicateAuditTaskSummary {
  return {
    task: summary.task,
    groups: summary.groups.filter((group) => matchesDuplicateAuditGroup(group, query, providerFilter)),
  };
}

function DuplicateAuditGroupRow({ group }: { group: DuplicateAuditGroupSummary }) {
  return (
    <div className="grid gap-2 rounded-md border border-white/[0.07] bg-black/[0.10] px-3 py-2 md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="border-amber-300/25 bg-amber-300/10 text-amber-100">重复</Badge>
          <span className="break-all font-mono text-xs font-medium text-slate-200">{providerLabel(group.provider)} {group.externalId}</span>
        </div>
        <div className="mt-1 text-[11px] text-slate-600">{formatCount(group.gameCount)} 个游戏记录</div>
      </div>
      <div className="min-w-0 text-xs leading-5 text-slate-500">
        {group.games.map((game) => <span className="mr-2 inline-block max-w-full truncate align-bottom" key={game.gameId} title={`${game.title} [${game.gameId}]`}>{game.title}</span>)}
      </div>
    </div>
  );
}

function DuplicateCompactStat({ label, value, tone = 'neutral' }: { label: string; value: number | string; tone?: 'neutral' | 'ok' | 'warn' }) {
  const toneClass = tone === 'ok' ? 'text-emerald-200' : tone === 'warn' ? 'text-amber-200' : 'text-slate-200';
  const displayValue = typeof value === 'number' ? formatCount(value) : value;
  return (
    <SoftRow className="px-3 py-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 font-mono text-sm ${toneClass}`}>{displayValue}</div>
    </SoftRow>
  );
}

function matchesDuplicateAuditGroup(group: DuplicateAuditGroupSummary, query: string, providerFilter: string) {
  if (providerFilter !== 'all' && group.provider !== providerFilter) return false;
  const value = query.trim().toLowerCase();
  if (!value) return true;
  return [
    group.provider,
    providerLabel(group.provider),
    group.externalId,
    ...group.games.flatMap((game) => [game.title, game.gameId]),
  ].some((text) => String(text ?? '').toLowerCase().includes(value));
}

function parseDuplicateAuditLog(log: TaskLogEntry): DuplicateAuditGroupSummary[] {
  const message = log.message.trim();
  const group = message.match(/^重复组：([a-zA-Z0-9_-]+)\s+([^，,]+)，(\d+)\s*个游戏：(.+)$/);
  if (!group) return [];
  const [, provider, externalId, gameCount, gamesText] = group;
  const games = gamesText.split('|').map((token) => token.trim().match(/^(.+) \[([^\]]+)\]$/)).filter((match): match is RegExpMatchArray => Boolean(match)).map((match) => ({ title: match[1].trim(), gameId: match[2].trim() }));
  return [{ provider: provider.toLowerCase(), externalId: externalId.trim(), gameCount: Number(gameCount), games }];
}

function providerLabel(value: string) {
  if (value === 'vndb') return 'VNDB';
  if (value === 'bangumi') return 'Bangumi';
  if (value === 'dlsite') return 'DLsite';
  if (value === 'fanza') return 'FANZA';
  if (value === 'ymgal') return 'YMGal';
  return value;
}

function formatCount(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value);
}
