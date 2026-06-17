import { AlertTriangle, CalendarDays, CheckCircle2, Clock3, Copy, Edit3, FolderOpen, FolderSync, Layers3, ListTodo, NotebookText, Play, Plus, Save, Star, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CoverImage } from '@/components/ui/cover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState, Notice } from '@/components/ui/notice';
import { SoftRow } from '@/components/ui/page';
import { Select } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TaskNotice } from '@/components/ui/task-notice';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/services/api';
import { chooseDirectory, chooseExecutable } from '@/services/dialog';
import type { ImageReferenceAudit } from '@/types/archive';
import type { Game, GameCollection, PlaySession } from '@/types/game';
import type { GamePathHealth } from '@/types/game';
import { PLAY_STATUS_LABEL } from '@/types/game';
import type { LaunchProfile } from '@/types/launch';
import { errorMessage } from '@/utils/errorMessage';
import { formatDateTime, formatPlayTime } from '@/utils/time';
import { imageSrc } from '@/utils/imageSrc';
import { cn } from '@/utils/cn';
import { DetailSurface, HeaderRecordCard, InfoLine, InfoStack, PathRow, PlaySessionsPanel, Section } from './GameDetailParts';
import { AssetGallery, DescriptionRichText, MediaHealthStack, summarizeMediaHealth } from './GameDetailMedia';
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

          <Section title="本地路径">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge>{pathStatusLabel(pathHealth?.status ?? game.pathStatus)}</Badge>
              {game.lastPathCheckedAt && <span className="text-xs text-slate-500">上次检查 {formatDateTime(game.lastPathCheckedAt)}</span>}
              <Button size="sm" variant="outline" onClick={checkPaths}><FolderSync className="h-4 w-4" />检查路径</Button>
              <Button size="sm" variant="outline" onClick={checkPathsInBackground}>后台检查</Button>
              <Button size="sm" variant="outline" onClick={() => void reveal(game.installPath)}><FolderOpen className="h-4 w-4" />打开目录</Button>
              <Button size="sm" variant="secondary" onClick={relocate}>重定位安装目录</Button>
              {onOpenTasks && <Button size="sm" variant="ghost" onClick={() => onOpenTasks()}><ListTodo className="h-4 w-4" />任务页</Button>}
            </div>
            {(pathHealth?.status ?? game.pathStatus) === 'broken' && (
              <Notice className="mb-3 text-xs" tone="warning">
                <span className="inline-flex items-center gap-2"><AlertTriangle className="h-3.5 w-3.5" />检测到路径异常。可以先重定位安装目录，应用会同步更新同前缀的启动程序、工作目录和启动配置。</span>
              </Notice>
            )}
            {(pathHealth?.status ?? game.pathStatus) === 'incomplete' && (
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
                    {item.path ? <Button aria-label={`复制路径检查${item.label}`} size="sm" variant="ghost" onClick={() => void copyPath(`路径检查${item.label}`, item.path)}><Copy className="h-4 w-4" />复制</Button> : <span />}
                  </SoftRow>
                ))}
              </div>
            )}
            <dl className="space-y-2 text-sm">
              <PathRow label="安装目录" value={game.installPath} onCopy={() => void copyPath('安装目录', game.installPath)} onReveal={() => void reveal(game.installPath)} />
              <PathRow label="启动程序" value={game.executablePath || '未选择'} onCopy={game.executablePath ? () => void copyPath('启动程序', game.executablePath) : undefined} onReveal={game.executablePath ? () => void reveal(game.executablePath) : undefined} />
              <PathRow label="工作目录" value={game.workingDirectory || '默认安装目录'} onCopy={game.workingDirectory ? () => void copyPath('工作目录', game.workingDirectory) : undefined} onReveal={game.workingDirectory ? () => void reveal(game.workingDirectory) : undefined} />
              <PathRow label="启动参数" value={game.launchArgs || '无'} />
            </dl>
          </Section>

          <Section title="外部 ID">
            {renderExternalIds()}
          </Section>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}

function pathHealthMessage(status: string) {
  if (status === 'ok') return '路径检查完成，所有关键路径可用。';
  if (status === 'incomplete') return '路径检查完成，有部分路径尚未配置。';
  if (status === 'broken') return '路径检查完成，发现不可用路径。';
  return '路径检查完成。';
}

function pathStatusLabel(status: string) {
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

function GameCollectionsPanel({ game, onEdit }: { game: Game; onEdit: () => void }) {
  const [collections, setCollections] = useState<GameCollection[]>([]);
  const [linkedCollections, setLinkedCollections] = useState<GameCollection[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const linkedIds = useMemo(() => new Set(linkedCollections.map((item) => item.id)), [linkedCollections]);
  const available = collections.filter((item) => !linkedIds.has(item.id));

  useEffect(() => {
    void refresh();
  }, [game.id]);

  const add = async () => {
    const targetId = selectedId || available[0]?.id;
    if (!targetId) return;
    try {
      await api.addGameToCollection(targetId, game.id);
      setSelectedId('');
      setMessage('已加入合集。');
      await refresh();
    } catch (reason) {
      setMessage(errorMessage(reason));
    }
  };

  const remove = async (collectionId: string) => {
    try {
      await api.removeGameFromCollection(collectionId, game.id);
      setMessage('已从合集移除。');
      await refresh();
    } catch (reason) {
      setMessage(errorMessage(reason));
    }
  };

  return (
    <div className="space-y-3">
      {message && <Notice className="py-2 text-xs">{message}</Notice>}
      <div className="flex flex-wrap items-center gap-2">
        {linkedCollections.length === 0 ? <span className="text-sm text-slate-500">尚未加入合集。</span> : linkedCollections.map((collection) => (
          <Badge className="gap-1" key={collection.id}><Layers3 className="h-3 w-3" />{collection.name}<button className="ml-1 text-slate-400 hover:text-slate-100" onClick={() => remove(collection.id)} type="button"><X className="h-3 w-3" /></button></Badge>
        ))}
        {available.length > 0 ? (
          <>
            <Select className="h-7 min-w-44 text-xs" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
              <option value="">选择合集</option>
              {available.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}
            </Select>
            <Button className="h-7 px-2" size="sm" variant="ghost" onClick={add}><Plus className="h-4 w-4" />加入</Button>
          </>
        ) : <Button className="h-7 px-2" size="sm" variant="ghost" onClick={onEdit}>编辑</Button>}
      </div>
    </div>
  );

  async function refresh() {
    try {
      const nextCollections = await api.listCollections();
      const linked = await Promise.all(nextCollections.map(async (collection) => {
        const games = await api.listCollectionGames(collection.id);
        return games.some((item) => item.id === game.id) ? collection : null;
      }));
      setCollections(nextCollections);
      setLinkedCollections(linked.filter(Boolean) as GameCollection[]);
    } catch (reason) {
      setMessage(errorMessage(reason));
    }
  }
}

function LaunchProfilesPanel({ game, profiles, selectedProfileId, onSelect, onChanged, onMessage }: { game: Game; profiles: LaunchProfile[]; selectedProfileId: string; onSelect: (id: string) => void; onChanged: (profiles: LaunchProfile[]) => void; onMessage: (message: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '默认启动',
    executablePath: game.executablePath ?? '',
    workingDirectory: game.workingDirectory ?? game.installPath,
    arguments: game.launchArgs ?? '',
    runnerType: 'direct',
    environmentVariables: '',
    localeEmulatorPath: '',
    preLaunchCommand: '',
    postLaunchCommand: '',
    runAsAdmin: false,
    compatibilityNotes: '',
  });

  const refresh = async () => onChanged(await api.listLaunchProfiles(game.id));

  const createProfile = async () => {
    if (!form.executablePath.trim()) {
      onMessage('启动程序不能为空。');
      return;
    }
    setSaving(true);
    try {
      await api.createLaunchProfile({
        gameId: game.id,
        name: form.name,
        executablePath: form.executablePath,
        workingDirectory: form.workingDirectory,
        arguments: form.arguments,
        runnerType: form.runnerType,
        environmentVariables: form.environmentVariables,
        localeEmulatorPath: form.localeEmulatorPath,
        preLaunchCommand: form.preLaunchCommand,
        postLaunchCommand: form.postLaunchCommand,
        runAsAdmin: form.runAsAdmin,
        compatibilityNotes: form.compatibilityNotes,
        isDefault: profiles.length === 0,
      });
      await refresh();
      setEditing(false);
      onMessage('启动配置已保存。');
    } catch (reason) {
      onMessage(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  };

  const setDefault = async (id: string) => {
    try {
      await api.setDefaultLaunchProfile(id);
      await refresh();
      onMessage('默认启动配置已更新。');
    } catch (reason) {
      onMessage(errorMessage(reason));
    }
  };

  const remove = async (profile: LaunchProfile) => {
    if (profile.id.startsWith('legacy-')) {
      onMessage('旧版默认启动配置来自游戏字段，请在编辑游戏中修改。');
      return;
    }
    if (!window.confirm('删除这个启动配置？不会删除真实文件。')) return;
    try {
      await api.deleteLaunchProfile(profile.id);
      await refresh();
      onMessage('启动配置已删除。');
    } catch (reason) {
      onMessage(errorMessage(reason));
    }
  };

  const pickExecutable = async (field: 'executablePath' | 'localeEmulatorPath') => {
    const selected = await chooseExecutable(form[field]);
    if (selected) setForm((current) => ({ ...current, [field]: selected }));
  };

  const pickWorkingDirectory = async () => {
    const selected = await chooseDirectory(form.workingDirectory);
    if (selected) setForm((current) => ({ ...current, workingDirectory: selected }));
  };

  const copyProfilePath = async (label: string, path: string) => {
    try {
      await navigator.clipboard.writeText(path);
      onMessage(`已复制${label}路径。`);
    } catch (reason) {
      onMessage(errorMessage(reason));
    }
  };

  const executableFieldLabel = form.runnerType === 'custom_command' ? '命令或程序' : '启动程序';

  return (
    <div className="space-y-3">
      {profiles.length === 0 ? (
        <EmptyState>还没有启动配置。可以从当前游戏路径创建一个默认配置。</EmptyState>
      ) : (
        <div className="space-y-2">
          <label className="space-y-1.5">
            <Label>用于启动</Label>
            <Select value={selectedProfileId} onChange={(event) => onSelect(event.target.value)}>
              {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}{profile.isDefault ? ' · 默认' : ''}</option>)}
            </Select>
          </label>
          {profiles.map((profile) => (
            <SoftRow className="grid gap-3 lg:grid-cols-[1fr_auto]" key={profile.id}>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-100">
                  <span>{profile.name}</span>
                  <Badge>{profile.runnerType}</Badge>
                  {profile.isDefault && <Badge><CheckCircle2 className="mr-1 h-3 w-3" />默认</Badge>}
                </div>
                <div className="mt-1 break-all font-mono text-xs text-slate-500">{profile.executablePath}</div>
                <div className="mt-1 text-xs text-slate-500">{profile.arguments || '无启动参数'}</div>
                {(profile.localeEmulatorPath || profile.preLaunchCommand || profile.postLaunchCommand || profile.environmentVariables) && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {profile.localeEmulatorPath && <Badge>Locale Emulator</Badge>}
                    {profile.environmentVariables && <Badge>环境变量</Badge>}
                    {profile.preLaunchCommand && <Badge>启动前脚本</Badge>}
                    {profile.postLaunchCommand && <Badge>结束后脚本</Badge>}
                  </div>
                )}
                {profile.compatibilityNotes && <div className="mt-2 text-xs text-slate-500">{profile.compatibilityNotes}</div>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button aria-label={`复制${profile.name}路径`} size="sm" variant="outline" onClick={() => void copyProfilePath(profile.name, profile.executablePath)}><Copy className="h-4 w-4" />复制</Button>
                <Button disabled={profile.isDefault || profile.id.startsWith('legacy-')} size="sm" variant="outline" onClick={() => setDefault(profile.id)}>设默认</Button>
                <Button size="sm" variant="ghost" onClick={() => remove(profile)}>删除</Button>
              </div>
            </SoftRow>
          ))}
        </div>
      )}

      {editing ? (
        <div className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1.5"><Label>名称</Label><Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
            <label className="space-y-1.5"><Label>类型</Label><Select value={form.runnerType} onChange={(event) => setForm((current) => ({ ...current, runnerType: event.target.value }))}><option value="direct">直接启动</option><option value="shortcut_lnk">快捷方式</option><option value="locale_emulator">Locale Emulator</option><option value="custom_command">自定义命令</option></Select></label>
          </div>
          <label className="mt-3 block space-y-1.5"><Label>{executableFieldLabel}</Label><div className="flex gap-2"><Input value={form.executablePath} onChange={(event) => setForm((current) => ({ ...current, executablePath: event.target.value }))} /><Button aria-label={`复制${executableFieldLabel}`} disabled={!form.executablePath.trim()} type="button" variant="outline" onClick={() => void copyProfilePath(executableFieldLabel, form.executablePath)}><Copy className="h-4 w-4" />复制</Button><Button type="button" variant="outline" onClick={() => void pickExecutable('executablePath')}>选择</Button></div></label>
          <label className="mt-3 block space-y-1.5"><Label>工作目录</Label><div className="flex gap-2"><Input value={form.workingDirectory} onChange={(event) => setForm((current) => ({ ...current, workingDirectory: event.target.value }))} /><Button aria-label="复制工作目录" disabled={!form.workingDirectory.trim()} type="button" variant="outline" onClick={() => void copyProfilePath('工作目录', form.workingDirectory)}><Copy className="h-4 w-4" />复制</Button><Button type="button" variant="outline" onClick={() => void pickWorkingDirectory()}>选择</Button></div></label>
          <label className="mt-3 block space-y-1.5"><Label>启动参数</Label><Input value={form.arguments} onChange={(event) => setForm((current) => ({ ...current, arguments: event.target.value }))} /></label>
          {form.runnerType === 'locale_emulator' && <label className="mt-3 block space-y-1.5"><Label>Locale Emulator 路径</Label><div className="flex gap-2"><Input value={form.localeEmulatorPath} onChange={(event) => setForm((current) => ({ ...current, localeEmulatorPath: event.target.value }))} /><Button aria-label="复制Locale Emulator" disabled={!form.localeEmulatorPath.trim()} type="button" variant="outline" onClick={() => void copyProfilePath('Locale Emulator', form.localeEmulatorPath)}><Copy className="h-4 w-4" />复制</Button><Button type="button" variant="outline" onClick={() => void pickExecutable('localeEmulatorPath')}>选择</Button></div></label>}
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="space-y-1.5"><Label>启动前命令</Label><Input value={form.preLaunchCommand} onChange={(event) => setForm((current) => ({ ...current, preLaunchCommand: event.target.value }))} /></label>
            <label className="space-y-1.5"><Label>结束后命令</Label><Input value={form.postLaunchCommand} onChange={(event) => setForm((current) => ({ ...current, postLaunchCommand: event.target.value }))} /></label>
          </div>
          <label className="mt-3 block space-y-1.5"><Label>环境变量</Label><Textarea placeholder={'KEY=value\nLANG=ja_JP'} value={form.environmentVariables} onChange={(event) => setForm((current) => ({ ...current, environmentVariables: event.target.value }))} /></label>
          <label className="mt-3 block space-y-1.5"><Label>兼容性备注</Label><Textarea value={form.compatibilityNotes} onChange={(event) => setForm((current) => ({ ...current, compatibilityNotes: event.target.value }))} /></label>
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-400"><input type="checkbox" checked={form.runAsAdmin} onChange={(event) => setForm((current) => ({ ...current, runAsAdmin: event.target.checked }))} />以管理员身份运行（UAC 启动后记录真实时长）</label>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(false)}>取消</Button>
            <Button disabled={saving} onClick={createProfile}>{saving ? '保存中...' : '保存配置'}</Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" onClick={() => setEditing(true)}><Plus className="h-4 w-4" />新增启动配置</Button>
      )}
    </div>
  );
}
