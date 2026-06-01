import { ChevronDown, DatabaseZap, FolderSearch, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckboxField } from '@/components/ui/checkbox';
import { CoverImage } from '@/components/ui/cover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Notice } from '@/components/ui/notice';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/services/api';
import { chooseDirectory, chooseExecutable, chooseImage } from '@/services/dialog';
import type { Game, GameFormInput, PlayStatus } from '@/types/game';
import { PLAY_STATUS_LABEL } from '@/types/game';
import { PROVIDER_LABEL, type MetadataSearchResult, type NormalizedMetadata } from '@/types/metadata';
import { cn } from '@/utils/cn';
import { errorMessage } from '@/utils/errorMessage';
import { friendlyMetadataErrors, metadataErrorMessage } from '@/utils/metadataErrors';

type GameFormProps = {
  game?: Game | null;
  onSubmit: (input: GameFormInput) => Promise<void>;
  onCancel: () => void;
};

type MetadataMergeMode = 'fill-empty' | 'replace';

const statusOptions: PlayStatus[] = ['planned', 'playing', 'completed', 'paused', 'archived'];

export function GameForm({ game, onSubmit, onCancel }: GameFormProps) {
  const initial = useMemo(() => ({
    title: game?.title ?? '',
    originalTitle: game?.originalTitle ?? '',
    aliases: game?.aliases.join(', ') ?? '',
    developer: game?.developer ?? '',
    publisher: game?.publisher ?? '',
    brand: game?.brand ?? '',
    releaseDate: game?.releaseDate ?? '',
    description: game?.description ?? '',
    notes: game?.notes ?? '',
    tags: game?.tags.join(', ') ?? '',
    genres: game?.genres.join(', ') ?? '',
    rating: game?.rating?.toString() ?? '',
    ageRating: game?.ageRating ?? '',
    playStatus: game?.playStatus ?? 'planned',
    installPath: game?.installPath ?? '',
    executablePath: game?.executablePath ?? '',
    workingDirectory: game?.workingDirectory ?? '',
    launchArgs: game?.launchArgs ?? '',
    coverImage: game?.coverImage ?? '',
    bannerImage: game?.bannerImage ?? '',
    backgroundImage: game?.backgroundImage ?? '',
    vndbId: game?.vndbId ?? '',
    dlsiteId: game?.dlsiteId ?? '',
    fanzaId: game?.fanzaId ?? '',
    bangumiId: game?.bangumiId ?? '',
    favorite: game?.favorite ?? false,
    hidden: game?.hidden ?? false,
  }), [game]);

  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scrapeMessage, setScrapeMessage] = useState<string | null>(null);
  const [scrapeCandidates, setScrapeCandidates] = useState<MetadataSearchResult[]>([]);
  const [selectedCandidateKey, setSelectedCandidateKey] = useState<string | null>(null);
  const isEditing = Boolean(game);
  const [advancedOpen, setAdvancedOpen] = useState(isEditing);

  useEffect(() => {
    setForm(initial);
    setError(null);
    setScrapeMessage(null);
    setScrapeCandidates([]);
    setSelectedCandidateKey(null);
    setAdvancedOpen(Boolean(game));
  }, [game, initial]);

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const updateBool = (key: 'favorite' | 'hidden', value: boolean) => setForm((current) => ({ ...current, [key]: value }));

  const pickDirectory = async (key: 'installPath' | 'workingDirectory') => {
    const selected = await chooseDirectory(form[key]);
    if (!selected) return;
    const next = {
      ...form,
      [key]: selected,
      workingDirectory: key === 'installPath' && !form.workingDirectory.trim() ? selected : form.workingDirectory,
    };
    setForm(next);
    if (key === 'installPath' && !game) {
      void autoScrapeFromPath(selected, next, 'replace');
    }
  };

  const pickExecutable = async () => {
    const selected = await chooseExecutable(form.executablePath);
    if (!selected) return;
    const guessedInstallPath = form.installPath || parentPath(selected);
    const next = {
      ...form,
      executablePath: selected,
      installPath: guessedInstallPath,
      workingDirectory: form.workingDirectory || guessedInstallPath,
    };
    setForm(next);
    if (!game) {
      void autoScrapeFromPath(guessTitleSourceFromExecutable(selected, guessedInstallPath), next, 'replace');
    }
  };

  const pickImage = async (key: 'coverImage' | 'bannerImage' | 'backgroundImage') => {
    const selected = await chooseImage(form[key]);
    if (selected) setForm((current) => ({ ...current, [key]: selected }));
  };

  const submit = async () => {
    if (!form.title.trim() || !form.installPath.trim()) {
      setError('标题和安装目录必填。');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        title: form.title,
        originalTitle: form.originalTitle,
        aliases: splitList(form.aliases),
        developer: form.developer,
        publisher: form.publisher,
        brand: form.brand,
        releaseDate: form.releaseDate,
        description: form.description,
        notes: form.notes,
        tags: splitList(form.tags),
        genres: splitList(form.genres),
        rating: form.rating ? Number(form.rating) : null,
        ageRating: form.ageRating,
        playStatus: form.playStatus as PlayStatus,
        installPath: form.installPath,
        executablePath: form.executablePath,
        workingDirectory: form.workingDirectory,
        launchArgs: form.launchArgs,
        pathStatus: game?.pathStatus ?? 'unknown',
        lastPathCheckedAt: game?.lastPathCheckedAt ?? null,
        coverImage: form.coverImage,
        bannerImage: form.bannerImage,
        backgroundImage: form.backgroundImage,
        vndbId: form.vndbId,
        dlsiteId: form.dlsiteId,
        fanzaId: form.fanzaId,
        bangumiId: form.bangumiId,
        favorite: form.favorite,
        hidden: form.hidden,
      });
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  };

  async function autoScrapeFromPath(path: string, baseForm = form, mergeMode: MetadataMergeMode = 'fill-empty') {
    const guessedTitle = guessTitleFromPath(path);
    if (!guessedTitle) return;

    setScraping(true);
    setError(null);
    setScrapeMessage(`正在用「${guessedTitle}」搜索 VNDB / DLsite / FANZA...`);
    setScrapeCandidates([]);
    setSelectedCandidateKey(null);
    setForm((current) => ({
      ...current,
      title: mergeMode === 'replace' || !current.title.trim() ? guessedTitle : current.title,
      aliases: mergeListText(current.aliases, guessedTitle),
    }));

    try {
      const response = await api.searchMetadata(guessedTitle, ['vndb', 'dlsite', 'fanza']);
      const candidates = response.results.slice(0, 5);
      setScrapeCandidates(candidates);
      if (response.errors.length > 0) {
        setError(friendlyMetadataErrors(response.errors).join(' '));
      }
      const selected = response.results.find((item) => item.fromVndbSniff) ?? response.results.find((item) => item.relevanceScore >= 0.3) ?? response.results[0] ?? null;
      if (!selected) {
        setScrapeMessage(`没有找到可靠元数据，已先填入识别标题「${guessedTitle}」。`);
        return;
      }

      setSelectedCandidateKey(candidateKey(selected));
      const detail = await loadMetadataDetail(selected);
      const nextForm = mergeMetadataIntoForm(baseForm, detail, guessedTitle, mergeMode);
      setForm((current) => ({ ...current, ...nextForm }));
      setScrapeMessage(`已预填推荐候选：${providerLabel(selected.provider)} ${selected.id}。可切换候选后再保存。`);
    } catch (reason) {
      setScrapeMessage(`自动识别失败，已先填入标题「${guessedTitle}」。`);
      setError(metadataErrorMessage(reason));
    } finally {
      setScraping(false);
    }
  }

  async function selectCandidate(candidate: MetadataSearchResult) {
    if (scraping) return;
    const guessedTitle = guessTitleFromPath(scrapeSource || form.title) || form.title;
    setScraping(true);
    setError(null);
    setSelectedCandidateKey(candidateKey(candidate));
    setScrapeMessage(`正在载入 ${providerLabel(candidate.provider)} ${candidate.id}...`);
    try {
      const detail = await loadMetadataDetail(candidate);
      setForm((current) => ({ ...current, ...mergeMetadataIntoForm(current, detail, guessedTitle, 'replace') }));
      setScrapeMessage(`已切换到 ${providerLabel(candidate.provider)} ${candidate.id}：${detail.title}`);
    } catch (reason) {
      setError(metadataErrorMessage(reason));
      setScrapeMessage(`候选详情载入失败，仍保留当前预填信息。`);
    } finally {
      setScraping(false);
    }
  }

  const scrapeSource = form.executablePath ? guessTitleSourceFromExecutable(form.executablePath, form.installPath) : form.installPath || form.title;
  const canScrape = !scraping && Boolean(guessTitleFromPath(scrapeSource));
  const hasMetadataPreview = Boolean(form.coverImage || form.developer || form.publisher || form.releaseDate || form.vndbId || form.dlsiteId || form.fanzaId || form.tags);
  const metadataBadges = [
    form.developer.trim(),
    form.releaseDate.trim(),
    form.vndbId.trim() ? `VNDB ${form.vndbId.trim()}` : '',
    form.dlsiteId.trim() ? `DLsite ${form.dlsiteId.trim()}` : '',
    form.fanzaId.trim() ? `FANZA ${form.fanzaId.trim()}` : '',
  ].filter(Boolean);

  return (
    <div className="space-y-3 text-slate-200">
      {error && <Notice tone="error">{error}</Notice>}
      {!isEditing && (
        <section className="rounded-lg border border-[rgb(var(--accent-rgb)/0.20)] bg-black/[0.18] p-3 shadow-sm shadow-black/20">
          <div className="flex gap-3">
            <CoverImage alt={form.title || '封面'} className="hidden h-24 w-16 shrink-0 rounded-md sm:block" src={form.coverImage} />
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                    {scraping ? <Loader2 className="h-4 w-4 animate-spin text-[rgb(var(--accent-rgb))]" /> : <DatabaseZap className="h-4 w-4 text-[rgb(var(--accent-rgb))]" />}
                    快速添加
                  </div>
                  <div className="mt-1 truncate text-xs text-slate-400">
                    {scrapeMessage || '选择目录或程序后自动预填。'}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button disabled={!canScrape} size="sm" type="button" variant="secondary" onClick={() => void autoScrapeFromPath(scrapeSource, form, 'replace')}>
                    <FolderSearch className="h-4 w-4" />重新识别
                  </Button>
                </div>
              </div>

              {hasMetadataPreview && (
                <div className="flex flex-wrap gap-1.5">
                  {metadataBadges.map((item) => <Badge className="min-h-5 px-2 text-[11px]" key={item}>{item}</Badge>)}
                </div>
              )}

              {scrapeCandidates.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-medium text-slate-400">候选结果</div>
                  <div className="grid gap-1.5">
                    {scrapeCandidates.slice(0, 4).map((candidate) => {
                      const active = selectedCandidateKey === candidateKey(candidate);
                      return (
                        <button
                          className={cn(
                            'group flex min-h-10 w-full items-center justify-between gap-3 rounded-md border px-2.5 py-2 text-left text-xs transition-colors',
                            active ? 'border-[rgb(var(--accent-rgb)/0.48)] bg-[rgb(var(--accent-rgb)/0.18)] text-slate-100' : 'border-white/10 bg-black/10 text-slate-300 hover:border-[rgb(var(--accent-rgb)/0.28)] hover:bg-white/[0.07]',
                          )}
                          disabled={scraping}
                          key={candidateKey(candidate)}
                          type="button"
                          onClick={() => void selectCandidate(candidate)}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{candidate.title}</span>
                            <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                              <span>{providerLabel(candidate.provider)} {candidate.id}</span>
                              {candidate.fromVndbSniff && <span className="text-[rgb(var(--accent-rgb))]">VNDB 嗅探</span>}
                            </span>
                          </span>
                          <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.07] px-2 py-0.5 text-[11px] text-slate-300">{Math.round(candidate.relevanceScore * 100)}%</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <div className={cn('grid gap-3', isEditing ? 'md:grid-cols-2' : 'grid-cols-1')}>
        <Field label="标题" required><Input value={form.title} onChange={(event) => update('title', event.target.value)} /></Field>
        {isEditing && <Field label="原名"><Input value={form.originalTitle} onChange={(event) => update('originalTitle', event.target.value)} /></Field>}
        {isEditing && (
          <Field label="游玩状态">
            <Select className="w-full" value={form.playStatus} onChange={(event) => update('playStatus', event.target.value)}>
              {statusOptions.map((status) => <option key={status} value={status}>{PLAY_STATUS_LABEL[status]}</option>)}
            </Select>
          </Field>
        )}
        <Field label="安装目录" required><InputWithButton value={form.installPath} onChange={(value) => update('installPath', value)} onPick={() => void pickDirectory('installPath')} /></Field>
        <Field label="启动程序"><InputWithButton value={form.executablePath} onChange={(value) => update('executablePath', value)} onPick={() => void pickExecutable()} /></Field>
      </div>

      <section className="rounded-lg border border-white/10 bg-black/[0.12]">
        <button className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left" type="button" onClick={() => setAdvancedOpen((value) => !value)}>
          <span className="text-sm font-medium text-slate-100">{isEditing ? '详细信息' : '高级信息'}</span>
          <ChevronDown className={cn('h-4 w-4 text-slate-400 transition-transform', advancedOpen && 'rotate-180')} />
        </button>

        {advancedOpen && (
          <div className="space-y-3 border-t border-white/10 p-3">
            {!isEditing && (
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="原名"><Input value={form.originalTitle} onChange={(event) => update('originalTitle', event.target.value)} /></Field>
                <Field label="游玩状态">
                  <Select className="w-full" value={form.playStatus} onChange={(event) => update('playStatus', event.target.value)}>
                    {statusOptions.map((status) => <option key={status} value={status}>{PLAY_STATUS_LABEL[status]}</option>)}
                  </Select>
                </Field>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="会社 / 开发商"><Input value={form.developer} onChange={(event) => update('developer', event.target.value)} /></Field>
              <Field label="品牌"><Input value={form.brand} onChange={(event) => update('brand', event.target.value)} /></Field>
              <Field label="发行商"><Input value={form.publisher} onChange={(event) => update('publisher', event.target.value)} /></Field>
              <Field label="发售日"><Input placeholder="YYYY-MM-DD" value={form.releaseDate} onChange={(event) => update('releaseDate', event.target.value)} /></Field>
              <Field label="评分"><Input min={0} max={100} type="number" value={form.rating} onChange={(event) => update('rating', event.target.value)} /></Field>
              <Field label="年龄分级"><Input value={form.ageRating} onChange={(event) => update('ageRating', event.target.value)} /></Field>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="工作目录"><InputWithButton value={form.workingDirectory} onChange={(value) => update('workingDirectory', value)} onPick={() => void pickDirectory('workingDirectory')} /></Field>
              <Field label="启动参数"><Input value={form.launchArgs} onChange={(event) => update('launchArgs', event.target.value)} /></Field>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <Field label="封面路径"><InputWithButton value={form.coverImage} onChange={(value) => update('coverImage', value)} onPick={() => void pickImage('coverImage')} /></Field>
              <Field label="横幅路径"><InputWithButton value={form.bannerImage} onChange={(value) => update('bannerImage', value)} onPick={() => void pickImage('bannerImage')} /></Field>
              <Field label="背景路径"><InputWithButton value={form.backgroundImage} onChange={(value) => update('backgroundImage', value)} onPick={() => void pickImage('backgroundImage')} /></Field>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <CheckboxField checked={form.favorite} label="收藏" onChange={(event) => updateBool('favorite', event.target.checked)} />
              <CheckboxField checked={form.hidden} label="隐藏条目" onChange={(event) => updateBool('hidden', event.target.checked)} />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="标签"><Input placeholder="逗号分隔" value={form.tags} onChange={(event) => update('tags', event.target.value)} /></Field>
              <Field label="类型"><Input placeholder="逗号分隔" value={form.genres} onChange={(event) => update('genres', event.target.value)} /></Field>
              <Field label="别名"><Input placeholder="逗号分隔" value={form.aliases} onChange={(event) => update('aliases', event.target.value)} /></Field>
              <Field label="VNDB ID"><Input value={form.vndbId} onChange={(event) => update('vndbId', event.target.value)} /></Field>
              <Field label="DLsite ID"><Input value={form.dlsiteId} onChange={(event) => update('dlsiteId', event.target.value)} /></Field>
              <Field label="FANZA ID"><Input value={form.fanzaId} onChange={(event) => update('fanzaId', event.target.value)} /></Field>
            </div>

            <Field label="简介"><Textarea value={form.description} onChange={(event) => update('description', event.target.value)} /></Field>
            <Field label="个人备注"><Textarea placeholder="攻略进度、补丁说明、通关感想、注意事项..." value={form.notes} onChange={(event) => update('notes', event.target.value)} /></Field>
          </div>
        )}
      </section>

      <div className="sticky bottom-0 z-10 -mx-5 -mb-5 flex justify-end gap-2 border-t border-white/10 bg-[rgb(var(--modal-rgb)/0.98)] px-5 py-3 backdrop-blur-xl">
        <Button type="button" variant="ghost" onClick={onCancel}>取消</Button>
        <Button type="button" disabled={saving} onClick={submit}>{saving ? '保存中...' : '保存'}</Button>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="space-y-1.5">
      <Label>{label}{required ? ' *' : ''}</Label>
      {children}
    </label>
  );
}

function InputWithButton({ value, onChange, onPick }: { value: string; onChange: (value: string) => void; onPick: () => void }) {
  return (
    <div className="flex gap-2">
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
      <Button className="shrink-0" type="button" variant="outline" onClick={onPick}>选择</Button>
    </div>
  );
}

function splitList(value: string) {
  return value.split(/[,，]/).map((item) => item.trim()).filter(Boolean);
}

function guessTitleFromPath(value: string) {
  const clean = value.trim();
  if (!clean) return '';
  const normalized = clean.replace(/\\/g, '/');
  const last = normalized.split('/').filter(Boolean).pop() ?? clean;
  const withoutExt = last.replace(/\.(exe|bat|cmd|lnk)$/i, '');
  const withoutDateCircle = withoutExt.replace(/^\[?\d{6}\]?\s*/g, '');
  return withoutDateCircle
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[【「『（《〈][^】」』）》〉]*[】」』）》〉]/g, ' ')
    .replace(/(?:汉化硬盘版|汉化版|硬盘版|绿色版|中文版|DL版|パッケージ版|Windows|Android|iOS|PC)/gi, ' ')
    .replace(/v(?:er)?\.?\s*[\d.]+[a-z]?/gi, ' ')
    .replace(/[_＿]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || withoutExt.trim();
}

function parentPath(value: string) {
  const index = Math.max(value.lastIndexOf('\\'), value.lastIndexOf('/'));
  return index > 0 ? value.slice(0, index) : '';
}

function guessTitleSourceFromExecutable(executablePath: string, installPath: string) {
  const executableTitle = guessTitleFromPath(executablePath).toLowerCase();
  if (!executableTitle || ['game', 'start', 'launcher', 'launch', 'setup', 'config', 'update', 'uninstall'].includes(executableTitle)) {
    return installPath || executablePath;
  }
  return executablePath;
}

function mergeListText(current: string, ...items: Array<string | null | undefined>) {
  const values = [...splitList(current), ...items.map((item) => item?.trim()).filter(Boolean) as string[]];
  return [...new Set(values)].join(', ');
}

function mergeMetadataIntoForm(current: typeof initialFormShape, metadata: NormalizedMetadata, guessedTitle: string, mode: MetadataMergeMode = 'fill-empty') {
  const shouldUse = (value: string) => mode === 'replace' || !value.trim();
  return {
    title: shouldUse(current.title) ? metadata.title || guessedTitle : current.title,
    originalTitle: shouldUse(current.originalTitle) ? metadata.originalTitle || metadata.title || '' : current.originalTitle,
    aliases: mergeListText(current.aliases, guessedTitle, ...(metadata.aliases ?? [])),
    developer: shouldUse(current.developer) ? metadata.developers[0] || '' : current.developer,
    publisher: shouldUse(current.publisher) ? metadata.publishers[0] || '' : current.publisher,
    releaseDate: shouldUse(current.releaseDate) ? metadata.releaseDate || '' : current.releaseDate,
    description: shouldUse(current.description) ? metadata.description || '' : current.description,
    tags: mode === 'replace' ? mergeListText('', ...(metadata.tags ?? [])) : mergeListText(current.tags, ...(metadata.tags ?? [])),
    genres: mode === 'replace' ? mergeListText('', ...(metadata.genres?.length ? metadata.genres : ['Visual Novel'])) : mergeListText(current.genres, ...(metadata.genres?.length ? metadata.genres : ['Visual Novel'])),
    coverImage: shouldUse(current.coverImage) ? metadata.images[0] || '' : current.coverImage,
    vndbId: shouldUse(current.vndbId) ? metadata.externalIds.vndb || '' : current.vndbId,
    dlsiteId: shouldUse(current.dlsiteId) ? metadata.externalIds.dlsite || '' : current.dlsiteId,
    fanzaId: shouldUse(current.fanzaId) ? metadata.externalIds.fanza || '' : current.fanzaId,
  };
}

function candidateKey(candidate: MetadataSearchResult) {
  return `${candidate.provider}:${candidate.id}`;
}

async function loadMetadataDetail(candidate: MetadataSearchResult) {
  return api.getMetadataDetail(candidate.provider, candidate.id).catch(() => resultToMetadata(candidate));
}

const initialFormShape = {
  title: '', originalTitle: '', aliases: '', developer: '', publisher: '', brand: '', releaseDate: '', description: '', notes: '', tags: '', genres: '', rating: '', ageRating: '', playStatus: 'planned' as PlayStatus, installPath: '', executablePath: '', workingDirectory: '', launchArgs: '', coverImage: '', bannerImage: '', backgroundImage: '', vndbId: '', dlsiteId: '', fanzaId: '', bangumiId: '', favorite: false, hidden: false,
};

function resultToMetadata(result: MetadataSearchResult): NormalizedMetadata {
  return {
    provider: result.provider,
    id: result.id,
    title: result.title,
    originalTitle: result.provider === 'vndb' ? result.title : null,
    aliases: [],
    description: result.description,
    releaseDate: result.releaseDate,
    developers: result.developers,
    publishers: [],
    tags: result.tags,
    genres: ['Visual Novel'],
    images: result.imageUrl ? [result.imageUrl] : [],
    externalIds: result.externalIds,
    ageRating: null,
  };
}

function providerLabel(value: string) {
  return value === 'vndb' || value === 'dlsite' || value === 'fanza' ? PROVIDER_LABEL[value] : value;
}
