import { Copy } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/notice';
import { Panel, PanelContent, SoftRow, PanelHeader } from '@/components/ui/page';
import type { PlaySession } from '@/types/game';
import type { LaunchProfile } from '@/types/launch';
import { formatDateTime, formatPlayTime } from '@/utils/time';

export function DetailSurface({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="detail-surface group bg-transparent">
      <div className="mb-3 flex items-center gap-2 border-b border-dashed border-white/15 pb-2 text-sm font-semibold text-slate-100">
        <span className="h-3.5 w-0.5 rounded-full bg-[rgb(var(--accent-rgb))]" />
        {title}
      </div>
      {children}
    </section>
  );
}

export function HeaderRecordCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="group flex min-w-[132px] items-center gap-3 text-white/90">
      <div className="text-slate-200 drop-shadow transition-colors group-hover:text-[rgb(var(--accent-rgb))]">{icon}</div>
      <div className="min-w-0">
        <div className="text-[11px] text-slate-400">{label}</div>
        <div className="mt-0.5 truncate text-sm font-medium text-slate-100">{value}</div>
      </div>
    </div>
  );
}

export function InfoStack({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="detail-info-stack bg-transparent">
      <div className="mb-3 border-b border-dashed border-white/15 pb-2 text-sm font-semibold text-slate-100">{title}</div>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

export function InfoLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2 py-1 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className="min-w-0 break-words text-slate-300">{value}</span>
    </div>
  );
}

export function PlaySessionsPanel({ sessions, profiles }: { sessions: PlaySession[]; profiles: LaunchProfile[] }) {
  const profileName = (profileId?: string | null) => profiles.find((profile) => profile.id === profileId)?.name ?? '默认启动';
  if (sessions.length === 0) {
    return <EmptyState>还没有游玩记录。启动游戏后会在这里显示开始时间、结束时间和时长。</EmptyState>;
  }

  return (
    <div className="space-y-2">
      {sessions.map((session) => (
        <SoftRow className="grid gap-3 px-3 py-3 lg:grid-cols-[1fr_8rem_8rem_7rem]" key={session.id}>
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-100">{formatDateTime(session.startedAt)}</div>
            <div className="mt-1 text-xs text-slate-500">{profileName(session.launchProfileId)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">结束时间</div>
            <div className="mt-1 text-xs text-slate-300">{formatDateTime(session.endedAt)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">时长</div>
            <div className="mt-1 text-sm text-slate-100">{formatPlayTime(session.durationSeconds)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">退出状态</div>
            <Badge className="mt-1">{session.exitStatus || (session.endedAt ? '未知' : '运行中')}</Badge>
          </div>
        </SoftRow>
      ))}
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Panel>
      <PanelHeader title={title} />
      <PanelContent>{children}</PanelContent>
    </Panel>
  );
}

export function PathRow({ label, value, onCopy, onReveal }: { label: string; value: string; onCopy?: () => void; onReveal?: () => void }) {
  return (
    <SoftRow className="grid gap-2 px-3 py-2 lg:grid-cols-[5rem_1fr_auto]">
      <dt className="text-slate-500">{label}</dt>
      <dd className="break-all font-mono text-xs text-slate-300">{value}</dd>
      <div className="flex shrink-0 justify-end gap-1">
        {onCopy && <Button aria-label={`复制${label}`} size="sm" variant="ghost" onClick={onCopy}><Copy className="h-4 w-4" />复制</Button>}
        {onReveal && <Button aria-label={`打开${label}`} size="sm" variant="ghost" onClick={onReveal}>打开</Button>}
      </div>
    </SoftRow>
  );
}
