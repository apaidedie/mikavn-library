import { Copy, NotebookText, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/notice';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TaskNotice } from '@/components/ui/task-notice';
import { Textarea } from '@/components/ui/textarea';
import type { Game } from '@/types/game';
import { PlaySessionsPanel, Section } from './GameDetailParts';
import { GameDetailHero } from './GameDetailHero';
import { GameDetailOverview } from './GameDetailOverview';
import { GamePathPanel } from './GamePathPanel';
import { LaunchProfilesPanel } from './LaunchProfilesPanel';
import { MetadataPanel } from './MetadataPanel';
import { useGameDetailActions } from './useGameDetailActions';

type GameDetailProps = {
  game: Game | null;
  onEdit: (game: Game) => void;
  onDeleted: () => void;
  onChanged?: (game: Game) => void;
  onOpenMaintenance?: (section?: string | null) => void;
  onOpenTasks?: (taskId?: string | null) => void;
  blurCover?: boolean;
};

export function GameDetail({ game, onEdit, onDeleted, onChanged, onOpenMaintenance, onOpenTasks, blurCover = false }: GameDetailProps) {
  const detail = useGameDetailActions({ game, onChanged, onDeleted });
  const actions = detail.actions;

  if (!game) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <EmptyState className="w-full max-w-sm">
          <div className="mx-auto mb-4 h-20 w-14 rounded-md border border-white/10 bg-white/[0.06] shadow-lg shadow-black/20" />
          <div className="text-sm text-slate-400">选择一个游戏查看详情，或手动添加新条目。</div>
        </EmptyState>
      </div>
    );
  }

  const externalIds = (
    <ExternalIds
      items={externalIdItems(game)}
      onCopy={(label, value) => void actions.copyText(`${label} ID`, value)}
    />
  );

  return (
    <div className="relative h-full overflow-auto bg-transparent">
      <GameDetailHero blurCover={blurCover} game={game} selectedProfile={detail.selectedProfile} onEdit={onEdit} onLaunch={() => void actions.launch()} onRemove={() => void actions.remove()} />

      <div className="relative z-10">
        {detail.message && <div className="mx-7 mt-5"><TaskNotice message={detail.message.text} taskId={detail.message.taskId} onOpenTask={onOpenTasks} /></div>}

        <Tabs defaultValue="overview" className="gap-0">
          <TabsList className="sticky top-0 z-20 w-full justify-start border-b border-white/10 bg-[rgb(var(--app-bg-rgb)/0.90)] px-7 pt-3 backdrop-blur-xl">
            <TabsTrigger value="overview">概览</TabsTrigger>
            <TabsTrigger value="records">记录</TabsTrigger>
            <TabsTrigger value="metadata">元数据</TabsTrigger>
            <TabsTrigger value="notes">备注</TabsTrigger>
            <TabsTrigger value="files">路径</TabsTrigger>
          </TabsList>

          <TabsContent className="px-7 py-5" value="overview">
            <GameDetailOverview
              blurCover={blurCover}
              externalIds={externalIds}
              game={game}
              imageAudit={detail.imageAudit}
              imageAuditLoading={detail.imageAuditLoading}
              pathHealth={detail.pathHealth}
              onChanged={onChanged}
              onEdit={onEdit}
              onImageAudit={() => void actions.checkImageReferences()}
              onMessage={actions.setMessage}
              onOpenMaintenance={onOpenMaintenance}
            />
          </TabsContent>

          <TabsContent className="space-y-5 px-7 py-5" value="records">
            <Section title="游玩记录">
              <PlaySessionsPanel sessions={detail.sessions} profiles={detail.profiles} />
            </Section>
          </TabsContent>

          <TabsContent className="px-7 py-5" value="metadata">
            <Section title="检索与写入">
              <MetadataPanel key={game.id} game={game} onApplied={(updated) => { actions.setMessage({ text: '元数据已更新。' }); onChanged?.(updated); }} />
            </Section>
          </TabsContent>

          <TabsContent className="space-y-5 px-7 py-5" value="notes">
            <Section title="个人备注">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-slate-500"><NotebookText className="h-3.5 w-3.5 text-[rgb(var(--accent-rgb))]" />本地保存，不会随元数据自动覆盖。</div>
                <Textarea className="min-h-56" placeholder="攻略进度、补丁说明、通关感想、注意事项..." value={detail.notesDraft} onChange={(event) => actions.setNotesDraft(event.target.value)} />
                <div className="flex justify-end">
                  <Button disabled={detail.savingNotes || detail.notesDraft === (game.notes ?? '')} onClick={() => void actions.saveNotes()}><Save className="h-4 w-4" />{detail.savingNotes ? '保存中...' : '保存备注'}</Button>
                </div>
              </div>
            </Section>
          </TabsContent>

          <TabsContent className="space-y-5 px-7 py-5" value="files">
            <Section title="启动配置">
              <LaunchProfilesPanel
                game={game}
                profiles={detail.profiles}
                selectedProfileId={detail.selectedProfileId}
                onSelect={actions.setSelectedProfileId}
                onChanged={(items) => {
                  actions.setProfiles(items);
                  actions.setSelectedProfileId(items.find((item) => item.isDefault)?.id ?? items[0]?.id ?? '');
                }}
                onMessage={(value) => actions.setMessage(value ? { text: value } : null)}
              />
            </Section>

            <GamePathPanel
              game={game}
              pathHealth={detail.pathHealth}
              onCheckPaths={() => void actions.checkPaths()}
              onCheckPathsInBackground={() => void actions.checkPathsInBackground()}
              onCopyPath={(label, path) => void actions.copyPath(label, path)}
              onOpenTasks={onOpenTasks}
              onRelocate={() => void actions.relocate()}
              onRevealPath={(path) => void actions.reveal(path)}
            />

            <Section title="外部 ID">{externalIds}</Section>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ExternalIds({ items, onCopy }: { items: Array<{ label: string; value: string }>; onCopy: (label: string, value: string) => void }) {
  if (items.length === 0) return <span className="text-sm text-slate-500">暂无外部 ID</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Button aria-label={`复制 ${item.label} ID`} className="h-7 px-2" key={item.label} size="sm" title={`复制 ${item.label} ID`} variant="outline" onClick={() => onCopy(item.label, item.value)}>
          <Copy className="h-3.5 w-3.5" />
          {item.label} {item.value}
        </Button>
      ))}
    </div>
  );
}

function externalIdItems(game: Game) {
  return [
    { label: 'VNDB', value: game.vndbId },
    { label: 'DLsite', value: game.dlsiteId },
    { label: 'FANZA', value: game.fanzaId },
    { label: 'Bangumi', value: game.bangumiId },
    { label: 'YMGal', value: game.ymgalId },
  ].filter((item): item is { label: string; value: string } => Boolean(item.value?.trim()));
}
