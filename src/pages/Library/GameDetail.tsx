import { CalendarDays, Clock3, Copy, Edit3, NotebookText, Play, Save, Star, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CoverImage } from '@/components/ui/cover';
import { EmptyState } from '@/components/ui/notice';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TaskNotice } from '@/components/ui/task-notice';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/services/api';
import { chooseDirectory } from '@/services/dialog';
import type { ImageReferenceAudit } from '@/types/archive';
import type { Game, PlaySession } from '@/types/game';
import type { GamePathHealth } from '@/types/game';
import { PLAY_STATUS_LABEL } from '@/types/game';
import type { LaunchProfile } from '@/types/launch';
import { errorMessage } from '@/utils/errorMessage';
import { formatDateTime, formatPlayTime } from '@/utils/time';
import { imageSrc } from '@/utils/imageSrc';
import { cn } from '@/utils/cn';
import { GameCollectionsPanel } from './GameCollectionsPanel';
import { DetailSurface, HeaderRecordCard, InfoLine, InfoStack, PlaySessionsPanel, Section } from './GameDetailParts';
import { AssetGallery, DescriptionRichText, MediaHealthStack, summarizeMediaHealth } from './GameDetailMedia';
import { GamePathPanel, pathHealthMessage, pathStatusLabel } from './GamePathPanel';
import { LaunchProfilesPanel } from './LaunchProfilesPanel';
import { MetadataPanel } from './MetadataPanel';

type GameDetailProps = {
  game: Game | null;
  onEdit: (game: Game) => void;
  onDeleted: () => void;
  onChanged?: (game: Game) => void;
  onOpenMaintenance?: (section?: string | null) => void;
  onOpenTasks?: (taskId?: string | null) => void;
  blurCover?: boolean;
};

type TaskMessage = { text: string; taskId?: string | null };

export function GameDetail({ game, onEdit, onDeleted, onChanged, onOpenMaintenance, onOpenTasks, blurCover = false }: GameDetailProps) {
  const [message, setMessage] = useState<TaskMessage | null>(null);
  const [profiles, setProfiles] = useState<LaunchProfile[]>([]);
  const [sessions, setSessions] = useState<PlaySession[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [pathHealth, setPathHealth] = useState<GamePathHealth | null>(null);
  const [imageAudit, setImageAudit] = useState<ImageReferenceAudit | null>(null);
  const [imageAuditLoading, setImageAuditLoading] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const selectedProfile = useMemo(() => profiles.find((profile) => profile.id === selectedProfileId) ?? profiles.find((profile) => profile.isDefault) ?? profiles[0], [profiles, selectedProfileId]);

  useEffect(() => {
    if (!game) return;
    setMessage(null);
    setImageAudit(null);
    setImageAuditLoading(false);
    setNotesDraft(game.notes ?? '');
    api.listLaunchProfiles(game.id)
      .then((items) => {
        setProfiles(items);
        setSelectedProfileId(items.find((item) => item.isDefault)?.id ?? items[0]?.id ?? '');
      })
      .catch((reason) => setMessage({ text: errorMessage(reason) }));
    api.listPlaySessions(game.id).then(setSessions).catch(() => setSessions([]));
  }, [game?.id]);

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

  const launch = async () => {
    setMessage(null);
    try {
      await api.launchGameWithProfile(game.id, selectedProfile?.id);
      setMessage({ text: '已发送启动请求。游戏退出后会自动累计时长。' });
      api.listPlaySessions(game.id).then(setSessions).catch(() => undefined);
    } catch (reason) {
      setMessage({ text: errorMessage(reason) });
    }
  };

  const remove = async () => {
    const ok = window.confirm('只删除数据库记录，不会删除真实游戏文件。确认删除吗？');
    if (!ok) return;
    await api.deleteGameRecord(game.id);
    onDeleted();
  };

  const checkPaths = async () => {
    setMessage(null);
    try {
      const health = await api.checkGamePaths(game.id);
      setPathHealth(health);
      onChanged?.(await api.getGame(game.id));
      setMessage({ text: pathHealthMessage(health.status) });
    } catch (reason) {
      setMessage({ text: errorMessage(reason) });
    }
  };

  const checkPathsInBackground = async () => {
    setMessage(null);
    try {
      const task = await api.checkGamePathsTask(game.id);
      setMessage({ text: `已创建路径检查任务：${task.message || '可在任务页查看进度。'}`, taskId: task.id });
    } catch (reason) {
      setMessage({ text: errorMessage(reason) });
    }
  };

  const relocate = async () => {
    const selected = await chooseDirectory(game.installPath);
    if (!selected) return;
    try {
      const updated = await api.relocateGamePaths(game.id, selected);
      onChanged?.(updated);
      setPathHealth(null);
      setMessage({ text: '安装目录已重定位，启动配置中的同前缀路径也已同步更新。' });
      api.listLaunchProfiles(game.id).then(setProfiles).catch(() => undefined);
    } catch (reason) {
      setMessage({ text: errorMessage(reason) });
    }
  };

  const saveNotes = async () => {
    setSavingNotes(true);
    setMessage(null);
    try {
      const updated = await api.updateGame(game.id, { notes: notesDraft });
      onChanged?.(updated);
      setMessage({ text: '个人备注已保存。' });
    } catch (reason) {
      setMessage({ text: errorMessage(reason) });
    } finally {
      setSavingNotes(false);
    }
  };

  const reveal = async (path?: string | null) => {
    if (!path) return;
    setMessage(null);
    try {
      await api.revealPath(path);
    } catch (reason) {
      setMessage({ text: errorMessage(reason) });
    }
  };

  const copyPath = async (label: string, path?: string | null) => {
    if (!path) return;
    setMessage(null);
    try {
      await navigator.clipboard.writeText(path);
      setMessage({ text: `已复制${label}路径。` });
    } catch (reason) {
      setMessage({ text: errorMessage(reason) });
    }
  };

  const copyText = async (label: string, value?: string | null) => {
    if (!value) return;
    setMessage(null);
    try {
      await navigator.clipboard.writeText(value);
      setMessage({ text: `已复制${label}。` });
    } catch (reason) {
      setMessage({ text: errorMessage(reason) });
    }
  };

  const externalIdItems = [
    { label: 'VNDB', value: game.vndbId },
    { label: 'DLsite', value: game.dlsiteId },
    { label: 'FANZA', value: game.fanzaId },
    { label: 'Bangumi', value: game.bangumiId },
    { label: 'YMGal', value: game.ymgalId },
  ].filter((item): item is { label: string; value: string } => Boolean(item.value?.trim()));

  const renderExternalIds = () => externalIdItems.length > 0 ? (
    <div className="flex flex-wrap gap-2">
      {externalIdItems.map((item) => (
        <Button aria-label={`复制 ${item.label} ID`} className="h-7 px-2" key={item.label} size="sm" title={`复制 ${item.label} ID`} variant="outline" onClick={() => void copyText(`${item.label} ID`, item.value)}>
          <Copy className="h-3.5 w-3.5" />
          {item.label} {item.value}
        </Button>
      ))}
    </div>
  ) : <span className="text-sm text-slate-500">暂无外部 ID</span>;

  const checkImageReferences = async () => {
    setImageAuditLoading(true);
    setMessage(null);
    try {
      const audit = await api.auditImageReferences({ gameId: game.id, includeOk: true, limit: 80 });
      setImageAudit(audit);
      setMessage({ text: audit.issueCount > 0 ? `图片引用检查完成：发现 ${audit.issueCount} 条问题引用。` : '图片引用检查完成，没有发现问题引用。' });
    } catch (reason) {
      setMessage({ text: errorMessage(reason) });
    } finally {
      setImageAuditLoading(false);
    }
  };

  const heroImage = imageSrc(game.backgroundImage || game.bannerImage || game.coverImage);
  const mediaHealth = summarizeMediaHealth(game);

  return (
    <div className="relative h-full overflow-auto bg-transparent">
      {heroImage && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <img alt="" className={cn('absolute inset-x-0 top-0 h-[520px] w-full object-cover opacity-55', blurCover && 'scale-105 blur-md')} src={heroImage} />
          <div className="absolute inset-x-0 top-0 h-[560px] bg-[linear-gradient(180deg,rgba(29,36,47,0.12),rgb(var(--app-bg-rgb))_86%),linear-gradient(90deg,rgb(var(--app-bg-rgb))_0%,rgb(var(--app-bg-rgb)/0.78)_32%,rgb(var(--app-bg-rgb)/0.34)_70%,rgb(var(--app-bg-rgb)/0.72)_100%)]" />
          <div className="absolute inset-0 bg-[rgb(var(--app-bg-rgb)/0.34)]" />
        </div>
      )}

      <div className="relative z-10">
        <div className="relative border-b border-white/10 px-7 py-5 pt-6">
        <div className="relative flex flex-col gap-5">
          <div className="flex items-end justify-between gap-7">
            <div className="min-w-0 flex-1 pb-1">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge>{PLAY_STATUS_LABEL[game.playStatus]}</Badge>
                {game.favorite && <Badge className="border-amber-300/25 bg-amber-300/12 text-amber-100"><Star className="mr-1 h-3 w-3 fill-amber-200 text-amber-200" />收藏</Badge>}
                {game.hidden && <Badge>隐藏</Badge>}
                {selectedProfile && <Badge>{selectedProfile.name}</Badge>}
              </div>
              <h2 className="line-clamp-2 max-w-4xl text-2xl font-bold leading-tight text-white drop-shadow-lg">{game.title}</h2>
              <p className="mt-2 truncate text-sm text-slate-300 drop-shadow">{game.originalTitle || game.brand || game.developer || '未填写原名或会社'}</p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Button className="h-10 w-[170px] rounded-lg shadow-lg shadow-black/25" disabled={!selectedProfile} onClick={launch}><Play className="h-4 w-4 fill-current" />启动</Button>
                <Button variant="secondary" onClick={() => onEdit(game)}><Edit3 className="h-4 w-4" />编辑</Button>
                <Button aria-label="删除记录" className="w-9 px-0" title="删除记录" variant="ghost" onClick={remove}><Trash2 className="h-4 w-4 text-rose-200" /></Button>
              </div>
            </div>
            <CoverImage alt={game.title} blur={blurCover} className="aspect-[2/3] h-[170px] shrink-0 rounded-lg shadow-2xl shadow-black/45 ring-1 ring-white/10" src={game.coverImage} />
          </div>

          <div className="flex flex-wrap items-center gap-12 pl-1 pt-3">
            <HeaderRecordCard icon={<Clock3 className="h-7 w-7" />} label="游玩时间" value={formatPlayTime(game.totalPlaySeconds)} />
            <HeaderRecordCard icon={<CalendarDays className="h-7 w-7" />} label="最近游玩" value={formatDateTime(game.lastPlayedAt)} />
            <HeaderRecordCard icon={<Play className="h-7 w-7" />} label="游玩状态" value={PLAY_STATUS_LABEL[game.playStatus]} />
            <HeaderRecordCard icon={<Star className="h-7 w-7" />} label="评分" value={game.rating ? `${game.rating}/100` : '暂无'} />
          </div>
        </div>
      </div>

      {message && <div className="mx-7 mt-5"><TaskNotice message={message.text} taskId={message.taskId} onOpenTask={onOpenTasks} /></div>}

      <Tabs defaultValue="overview" className="gap-0">
        <TabsList className="sticky top-0 z-20 w-full justify-start border-b border-white/10 bg-[rgb(var(--app-bg-rgb)/0.90)] px-7 pt-3 backdrop-blur-xl">
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="records">记录</TabsTrigger>
          <TabsTrigger value="metadata">元数据</TabsTrigger>
          <TabsTrigger value="notes">备注</TabsTrigger>
          <TabsTrigger value="files">路径</TabsTrigger>
        </TabsList>

        <TabsContent className="px-7 py-5" value="overview">
          <div className="grid gap-5 lg:grid-cols-4">
            <div className="col-span-1 min-w-0 space-y-5 lg:col-span-3">
              <DetailSurface title="简介">
                <DescriptionRichText value={game.description} />
              </DetailSurface>

              <DetailSurface title="标签">
                <div className="flex flex-wrap gap-2">
                  {[...game.tags, ...game.genres].length === 0 ? <span className="text-sm text-slate-500">暂无标签</span> : [...game.tags, ...game.genres].map((tag) => <Badge key={tag}>{tag}</Badge>)}
                </div>
              </DetailSurface>

              <DetailSurface title="合集">
                <GameCollectionsPanel game={game} onEdit={() => onEdit(game)} />
              </DetailSurface>

              <DetailSurface title="媒体图库">
                <AssetGallery game={game} blurCover={blurCover} onChanged={onChanged} onMessage={(value) => setMessage(value ? { text: value } : null)} />
              </DetailSurface>
            </div>

            <aside className="col-span-1 space-y-5 pt-0.5">
              <MediaHealthStack audit={imageAudit} auditLoading={imageAuditLoading} items={mediaHealth.items} missingCount={mediaHealth.missingCount} onAudit={() => void checkImageReferences()} onOpenMaintenance={onOpenMaintenance ? () => onOpenMaintenance('image-audit') : undefined} />

              <InfoStack title="信息">
                <InfoLine label="原名" value={game.originalTitle || '暂无'} />
                <InfoLine label="会社" value={game.developer || game.brand || '暂无'} />
                <InfoLine label="发行商" value={game.publisher || '暂无'} />
                <InfoLine label="发售日" value={game.releaseDate || '暂无'} />
                <InfoLine label="年龄" value={game.ageRating || '暂无'} />
                <InfoLine label="路径" value={pathStatusLabel(pathHealth?.status ?? game.pathStatus)} />
              </InfoStack>

              <InfoStack title="外部 ID">
                {renderExternalIds()}
              </InfoStack>
            </aside>
          </div>
        </TabsContent>

        <TabsContent className="space-y-5 px-7 py-5" value="records">
          <Section title="游玩记录">
            <PlaySessionsPanel sessions={sessions} profiles={profiles} />
          </Section>
        </TabsContent>

        <TabsContent className="px-7 py-5" value="metadata">
          <Section title="检索与写入">
            <MetadataPanel key={game.id} game={game} onApplied={(updated) => { setMessage({ text: '元数据已更新。' }); onChanged?.(updated); }} />
          </Section>
        </TabsContent>

        <TabsContent className="space-y-5 px-7 py-5" value="notes">
          <Section title="个人备注">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-slate-500"><NotebookText className="h-3.5 w-3.5 text-[rgb(var(--accent-rgb))]" />本地保存，不会随元数据自动覆盖。</div>
              <Textarea className="min-h-56" placeholder="攻略进度、补丁说明、通关感想、注意事项..." value={notesDraft} onChange={(event) => setNotesDraft(event.target.value)} />
              <div className="flex justify-end">
                <Button disabled={savingNotes || notesDraft === (game.notes ?? '')} onClick={saveNotes}><Save className="h-4 w-4" />{savingNotes ? '保存中...' : '保存备注'}</Button>
              </div>
            </div>
          </Section>
        </TabsContent>

        <TabsContent className="space-y-5 px-7 py-5" value="files">
          <Section title="启动配置">
            <LaunchProfilesPanel
              game={game}
              profiles={profiles}
              selectedProfileId={selectedProfileId}
              onSelect={setSelectedProfileId}
              onChanged={(items) => {
                setProfiles(items);
                setSelectedProfileId(items.find((item) => item.isDefault)?.id ?? items[0]?.id ?? '');
              }}
              onMessage={(value) => setMessage(value ? { text: value } : null)}
            />
          </Section>

          <GamePathPanel
            game={game}
            pathHealth={pathHealth}
            onCheckPaths={checkPaths}
            onCheckPathsInBackground={checkPathsInBackground}
            onCopyPath={copyPath}
            onOpenTasks={onOpenTasks}
            onRelocate={relocate}
            onRevealPath={reveal}
          />

          <Section title="外部 ID">
            {renderExternalIds()}
          </Section>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
