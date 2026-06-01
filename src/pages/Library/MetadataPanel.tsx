import { Check, Image, Lock, LockOpen, Search, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { EmptyState, Notice } from '@/components/ui/notice';
import { SoftRow } from '@/components/ui/page';
import { api } from '@/services/api';
import { chooseImage } from '@/services/dialog';
import type { Game } from '@/types/game';
import type { ApplyMetadataFields, FieldLock, MetadataProvider, MetadataSearchResult, NormalizedMetadata } from '@/types/metadata';
import { PROVIDER_LABEL } from '@/types/metadata';
import { cn } from '@/utils/cn';
import { errorMessage } from '@/utils/errorMessage';
import { friendlyMetadataErrors, metadataErrorMessage } from '@/utils/metadataErrors';

type MetadataPanelProps = {
  game: Game;
  onApplied: (game: Game) => void;
};

const defaultFields: ApplyMetadataFields = ['originalTitle', 'description', 'releaseDate', 'developer', 'tags', 'genres', 'coverImage', 'externalIds'];
const providers: MetadataProvider[] = ['vndb', 'dlsite', 'fanza'];

export function MetadataPanel({ game, onApplied }: MetadataPanelProps) {
  const [query, setQuery] = useState(game.title);
  const [enabledProviders, setEnabledProviders] = useState<MetadataProvider[]>(providers);
  const [results, setResults] = useState<MetadataSearchResult[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [selected, setSelected] = useState<MetadataSearchResult | null>(null);
  const [fields, setFields] = useState<ApplyMetadataFields>(defaultFields);
  const [fieldLocks, setFieldLocks] = useState<FieldLock[]>([]);
  const [forceLocked, setForceLocked] = useState(false);
  const [imagePath, setImagePath] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const groupedResults = useMemo(() => providers.map((provider) => ({
    provider,
    results: results.filter((result) => result.provider === provider),
  })).filter((group) => group.results.length > 0), [results]);
  const lockedFieldNames = useMemo(() => new Set(fieldLocks.filter((lock) => lock.lockedByUser).map((lock) => lock.fieldName)), [fieldLocks]);

  useEffect(() => {
    api.listFieldLocks(game.id).then(setFieldLocks).catch((reason) => setErrors([errorMessage(reason)]));
  }, [game.id]);

  const search = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await api.searchMetadata(query, enabledProviders);
      setResults(response.results);
      setErrors(friendlyMetadataErrors(response.errors));
      setSelected(response.results[0] ?? null);
      if (response.cleanedQuery && response.cleanedQuery !== query) {
        setMessage(`已生成清洗标题：${response.cleanedQuery}`);
      }
    } catch (reason) {
      setErrors([metadataErrorMessage(reason)]);
    } finally {
      setLoading(false);
    }
  };

  const autoMatch = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const suggestion = await api.matchMetadataForGame(game.id);
      setQuery(suggestion.cleanedTitle || suggestion.originalTitle);
      setResults(suggestion.candidates);
      setSelected(suggestion.selected ?? suggestion.candidates[0] ?? null);
      setMessage(suggestion.reason ?? `匹配状态：${suggestion.status}`);
    } catch (reason) {
      setErrors([metadataErrorMessage(reason)]);
    } finally {
      setLoading(false);
    }
  };

  const apply = async () => {
    if (!selected) return;
    setLoading(true);
    setMessage(null);
    try {
      const detail = await api.getMetadataDetail(selected.provider, selected.id).catch(() => resultToMetadata(selected));
      const updated = await api.applyMetadataToGame(game.id, detail, fields, forceLocked);
      onApplied(updated);
      const skipped = forceLocked ? [] : fields.filter((field) => lockedFieldNames.has(field));
      setMessage(skipped.length ? `元数据已写入；已跳过锁定字段：${skipped.map(fieldLabel).join('、')}` : '元数据已写入游戏条目。');
    } catch (reason) {
      setErrors([metadataErrorMessage(reason)]);
    } finally {
      setLoading(false);
    }
  };

  const recognize = async () => {
    if (!imagePath.trim()) return;
    setLoading(true);
    setMessage(null);
    setErrors([]);
    try {
      const recognition = await api.recognizeGameFromImage(imagePath.trim());
      setQuery(recognition.title);
      setMessage(`AI 识别候选：${recognition.title}`);
      if (recognition.title) {
        const response = await api.searchMetadata(recognition.title, enabledProviders);
        setResults(response.results);
        setSelected(response.results[0] ?? null);
        setErrors(friendlyMetadataErrors(response.errors));
      }
    } catch (reason) {
      setErrors([metadataErrorMessage(reason)]);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const selected = await chooseImage(imagePath);
    if (selected) {
      setImagePath(selected);
    }
  };

  const toggleProvider = (provider: MetadataProvider) => {
    setEnabledProviders((current) => current.includes(provider) ? current.filter((item) => item !== provider) : [...current, provider]);
  };

  const toggleField = (field: ApplyMetadataFields[number]) => {
    setFields((current) => current.includes(field) ? current.filter((item) => item !== field) as ApplyMetadataFields : [...current, field]);
  };

  const toggleLock = async (field: ApplyMetadataFields[number]) => {
    const next = !lockedFieldNames.has(field);
    try {
      await api.setFieldLock(game.id, field, next);
      setFieldLocks(await api.listFieldLocks(game.id));
      setMessage(next ? `${fieldLabel(field)} 已锁定，自动元数据默认不会覆盖。` : `${fieldLabel(field)} 已解锁。`);
    } catch (reason) {
      setErrors([errorMessage(reason)]);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {providers.map((provider) => (
            <button className={cn('rounded-md border px-2.5 py-1.5 text-xs transition-colors', enabledProviders.includes(provider) ? 'border-[rgb(var(--accent-rgb)/0.55)] bg-[rgb(var(--accent-rgb)/0.10)] text-[rgb(var(--accent-rgb))]' : 'border-white/10 bg-black/[0.12] text-slate-500 hover:text-slate-300')} key={provider} onClick={() => toggleProvider(provider)} type="button">
              {PROVIDER_LABEL[provider]}
            </button>
          ))}
        </div>
        <Button size="sm" variant="secondary" onClick={autoMatch}><Sparkles className="h-3.5 w-3.5" />自动匹配</Button>
      </div>

      <SoftRow className="flex gap-2 p-2">
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题或外部 ID" />
        <Button disabled={loading || !query.trim() || enabledProviders.length === 0} onClick={search}><Search className="h-4 w-4" />搜索</Button>
      </SoftRow>

      <SoftRow className="flex gap-2 p-2">
        <Input value={imagePath} onChange={(event) => setImagePath(event.target.value)} placeholder="本地图片路径，用于 AI 识别标题" />
        <Button disabled={loading} variant="outline" onClick={pickImage}><Image className="h-4 w-4" />选择</Button>
        <Button disabled={loading || !imagePath.trim()} variant="secondary" onClick={recognize}><Image className="h-4 w-4" />识图</Button>
      </SoftRow>

      {message && <Notice className="text-xs">{message}</Notice>}
      {errors.length > 0 && <Notice className="space-y-1 text-xs" tone="warning">{errors.map((error) => <div key={error}>{error}</div>)}</Notice>}

      <div className="space-y-2">
        {results.length === 0 ? (
          <EmptyState className="py-6 text-xs">搜索或自动匹配后会显示候选结果。</EmptyState>
        ) : groupedResults.map((group) => (
          <div className="space-y-2" key={group.provider}>
            <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
              <span>{PROVIDER_LABEL[group.provider]}</span>
              <span>{group.results.length} 个结果</span>
            </div>
            <div className="space-y-2">
              {group.results.map((result) => (
                <button className={cn('w-full rounded-lg border border-white/10 bg-black/[0.16] px-3 py-2 text-left transition-colors hover:border-[rgb(var(--accent-rgb)/0.45)]', selected?.provider === result.provider && selected.id === result.id && 'border-[rgb(var(--accent-rgb)/0.75)] bg-[rgb(var(--accent-rgb)/0.10)]')} key={`${result.provider}:${result.id}`} onClick={() => setSelected(result)} type="button">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 truncate text-sm text-slate-100">{result.title}</div>
                    <Badge>{Math.round(result.relevanceScore * 100)}%</Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-slate-500">
                    <span>{PROVIDER_LABEL[result.provider]} {result.id}</span>
                    {result.fromVndbSniff && <span className="text-[rgb(var(--accent-rgb))]">VNDB 嗅探</span>}
                    {result.releaseDate && <span>{result.releaseDate}</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {fieldOptions.map((option) => (
          <label className={cn('flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors hover:border-[rgb(var(--accent-rgb)/0.28)] hover:bg-white/[0.065]', lockedFieldNames.has(option.id) ? 'border-amber-300/20 bg-amber-300/10 text-amber-100' : 'border-white/10 bg-white/[0.045] text-slate-400')} key={option.id}>
            <Checkbox checked={fields.includes(option.id)} className="h-3.5 w-3.5" onChange={() => toggleField(option.id)} />
            {option.label}
            <button className="ml-1 text-slate-500 hover:text-slate-100" onClick={(event) => { event.preventDefault(); void toggleLock(option.id); }} type="button">
              {lockedFieldNames.has(option.id) ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
            </button>
          </label>
        ))}
      </div>

      {lockedFieldNames.size > 0 && (
        <label className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.035] px-2.5 py-2 text-xs text-slate-400">
          <Checkbox checked={forceLocked} className="h-3.5 w-3.5" onChange={(event) => setForceLocked(event.target.checked)} />
          覆盖锁定字段
        </label>
      )}

      <Button className="w-full" disabled={!selected || loading || fields.length === 0} onClick={apply}><Check className="h-4 w-4" />应用选中元数据</Button>
    </section>
  );
}

const fieldOptions: Array<{ id: ApplyMetadataFields[number]; label: string }> = [
  { id: 'title', label: '标题' },
  { id: 'originalTitle', label: '原名' },
  { id: 'description', label: '简介' },
  { id: 'releaseDate', label: '发售日' },
  { id: 'developer', label: '会社' },
  { id: 'tags', label: '标签' },
  { id: 'genres', label: '类型' },
  { id: 'coverImage', label: '封面' },
  { id: 'externalIds', label: '外部 ID' },
];

function fieldLabel(field: string) {
  return fieldOptions.find((option) => option.id === field)?.label ?? field;
}

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
