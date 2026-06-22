import { Bookmark, CheckCircle2, PlayCircle, Save, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CoverImage } from '@/components/ui/cover';
import { Input } from '@/components/ui/input';
import { EmptyState, Notice } from '@/components/ui/notice';
import { PageFrame, PageHeader, PageShell, Panel, PanelContent, PanelHeader, SoftRow } from '@/components/ui/page';
import { Select } from '@/components/ui/select';
import { api } from '@/services/api';
import type { Game } from '@/types/game';
import type { AdvancedSearchResult, SavedSearch, SearchQueryValidation } from '@/types/metadata';
import { errorMessage } from '@/utils/errorMessage';
import { formatPlayTime } from '@/utils/time';
import { formatAdvancedSearchResultDescription } from './advancedSearchPageModel';

const quickSearches = [
  { label: '高分作品', description: '评分 80 以上', query: 'rating>=80' },
  { label: '最近发售', description: '2020 年后的条目', query: 'released>=2020-01-01' },
  { label: '媒体不完整', description: '封面、横幅或背景待补', query: 'meta:missing_artwork' },
  { label: '缺简介图片', description: 'DLsite / FANZA 图片待补', query: 'meta:missing_description_image' },
  { label: '路径异常', description: '需要修复路径', query: 'path:broken' },
  { label: '玩过 10 小时', description: '游玩时间较长', query: 'playtime>=10h' },
];

const syntaxHints = ['tag:纯爱', 'dev:Key', 'meta:missing_artwork', '-status:archived', 'rating>=80', 'released>=2020-01-01', 'OR'];

export function AdvancedSearchPage({ refreshKey, onOpenGame }: { refreshKey: number; onOpenGame?: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [sortBy, setSortBy] = useState('updated_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [result, setResult] = useState<AdvancedSearchResult | null>(null);
  const [validation, setValidation] = useState<SearchQueryValidation | null>(null);
  const [saved, setSaved] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const validationRequestRef = useRef(0);
  const searchRequestRef = useRef(0);

  const resultGames = result?.games ?? [];
  const clauses = validation?.clauses ?? result?.clauses ?? [];
  const valid = validation?.valid ?? true;
  const canSave = valid && query.trim().length > 0;
  const activeSaved = useMemo(() => saved.find((item) => item.query === query.trim()), [query, saved]);
  const resultDescription = formatAdvancedSearchResultDescription(result ? {
    total: result.total,
    visible: resultGames.length,
  } : null);

  useEffect(() => {
    void loadSavedSearches();
  }, [refreshKey]);

  useEffect(() => {
    const nextQuery = query;
    const timer = window.setTimeout(() => void validate(nextQuery), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  async function validate(nextQuery = query) {
    const requestId = ++validationRequestRef.current;

    if (!nextQuery.trim()) {
      setValidation({ valid: true, errors: [], clauses: [] });
      return;
    }
    try {
      const nextValidation = await api.validateSearchQuery(nextQuery);
      if (requestId !== validationRequestRef.current) return;
      setValidation(nextValidation);
    } catch (reason) {
      if (requestId !== validationRequestRef.current) return;
      setValidation({ valid: false, errors: [errorMessage(reason)], clauses: [] });
    }
  }

  async function loadSavedSearches() {
    try {
      setSaved(await api.listSavedSearches());
    } catch {
      setSaved([]);
    }
  }

  async function runSearch(nextQuery = query) {
    const nextSortBy = sortBy;
    const nextSortDirection = sortDirection;
    const requestId = ++searchRequestRef.current;

    setLoading(true);
    setError(null);
    try {
      const next = await api.searchGamesAdvanced({ query: nextQuery, sortBy: nextSortBy, sortDirection: nextSortDirection, limit: 200 });
      if (requestId !== searchRequestRef.current) return;
      setResult(next);
      setValidation({ valid: next.errors.length === 0, errors: next.errors, clauses: next.clauses });
    } catch (reason) {
      if (requestId !== searchRequestRef.current) return;
      setError(errorMessage(reason));
    } finally {
      if (requestId !== searchRequestRef.current) return;
      setLoading(false);
    }
  }

  async function saveSearch() {
    if (!canSave) return;
    const searchName = name.trim() || activeSaved?.name || query.trim().slice(0, 36);
    try {
      if (activeSaved) {
        await api.updateSavedSearch(activeSaved.id, { name: searchName, query: query.trim(), description: null });
      } else {
        await api.createSavedSearch({ name: searchName, query: query.trim(), description: null });
      }
      setName('');
      await loadSavedSearches();
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  async function deleteSavedSearch(item: SavedSearch) {
    if (!window.confirm(`删除保存搜索「${item.name}」？这只删除保存的搜索条件，不会删除游戏记录，也不会删除真实游戏文件。`)) return;
    try {
      await api.deleteSavedSearch(item.id);
      await loadSavedSearches();
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  function applySavedSearch(item: SavedSearch) {
    setQuery(item.query);
    setName(item.name);
    void runSearch(item.query);
  }

  return (
    <PageShell>
      <PageFrame className="max-w-[82rem] gap-5">
        <PageHeader
          title="高级搜索"
          description="用标题、会社、标签或快捷条件筛选本地库。需要时再使用高级语法。"
          actions={<Button disabled={loading || !valid} onClick={() => void runSearch()}><Search className="h-4 w-4" />搜索</Button>}
        />
        {(error || validation?.errors.length) && (
          <div className="space-y-2">
            {error && <Notice tone="error">{error}</Notice>}
            {validation?.errors.map((item) => <Notice key={item} tone="warning">{item}</Notice>)}
          </div>
        )}

        <div className="grid min-h-[calc(100vh-10rem)] gap-4 xl:grid-cols-[24rem_minmax(0,1fr)]">
          <Panel>
            <PanelHeader title="筛选条件" icon={<SlidersHorizontal className="h-4 w-4" />} />
            <PanelContent className="space-y-4">
              <label className="space-y-2 block">
                <div className="text-xs font-medium text-slate-500">关键词或条件</div>
                <Input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void runSearch(); }} placeholder="输入标题、会社、标签，或点下面的快捷搜索" />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <Select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                  <option value="updated_at">最近更新</option>
                  <option value="last_played_at">最近游玩</option>
                  <option value="created_at">入库时间</option>
                  <option value="release_date">发售日</option>
                  <option value="rating">评分</option>
                  <option value="title">标题</option>
                </Select>
                <Select value={sortDirection} onChange={(event) => setSortDirection(event.target.value as 'asc' | 'desc')}>
                  <option value="desc">降序</option>
                  <option value="asc">升序</option>
                </Select>
              </div>
              {clauses.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {clauses.map((clause, index) => (
                    <Badge key={`${clause.kind}-${index}`} className={clause.negated ? 'border-rose-300/30 text-rose-100' : ''}>
                      {clause.negated ? '-' : ''}{clause.field ? `${clause.field}${clause.operator ?? ':'}` : ''}{clause.value}
                    </Badge>
                  ))}
                </div>
              )}
              {query.trim() && valid && <Notice className="py-2" tone="info"><CheckCircle2 className="mr-2 inline h-4 w-4" />条件可用。</Notice>}

              <div className="space-y-2">
                <div className="text-xs font-medium text-slate-500">快捷搜索</div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                  {quickSearches.map((item) => (
                    <button className="rounded-md border border-white/10 bg-black/[0.10] px-2.5 py-2 text-left hover:border-[rgb(var(--accent-rgb)/0.32)] hover:text-slate-100" key={item.query} onClick={() => { setQuery(item.query); void runSearch(item.query); }} type="button">
                      <div className="text-sm font-medium text-slate-200">{item.label}</div>
                      <div className="mt-0.5 text-xs text-slate-500">{item.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              <details className="rounded-md border border-white/10 bg-black/[0.08] px-3 py-2 text-xs text-slate-400">
                <summary className="cursor-pointer text-slate-300">高级语法</summary>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {syntaxHints.map((item) => <Badge key={item}>{item}</Badge>)}
                </div>
                <div className="mt-3 leading-6 text-slate-500">普通词会搜索标题、别名、会社、标签和备注；多个条件默认同时满足。</div>
              </details>

              <div className="space-y-2 border-t border-white/10 pt-4">
                <div className="text-xs font-medium text-slate-500">保存搜索</div>
                <div className="flex gap-2">
                  <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="搜索名称" />
                  <Button disabled={!canSave} variant="secondary" onClick={saveSearch}><Save className="h-4 w-4" />保存</Button>
                </div>
                <div className="space-y-2">
                  {saved.length === 0 ? <EmptyState className="py-6">还没有保存搜索。</EmptyState> : saved.map((item) => (
                    <SoftRow className="px-3 py-2" key={item.id}>
                      <div className="flex items-start justify-between gap-3">
                        <button className="min-w-0 text-left" onClick={() => applySavedSearch(item)} type="button">
                          <div className="flex items-center gap-2 text-sm font-medium text-slate-100"><Bookmark className="h-3.5 w-3.5 text-[rgb(var(--accent-rgb))]" />{item.name}</div>
                          <div className="mt-1 break-all font-mono text-xs text-slate-500">{item.query}</div>
                        </button>
                        <Button aria-label="删除保存搜索" className="h-7 w-7" size="icon" title="删除保存搜索" variant="ghost" onClick={() => void deleteSavedSearch(item)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </SoftRow>
                  ))}
                </div>
              </div>
            </PanelContent>
          </Panel>

          <Panel>
            <PanelHeader title="搜索结果" description={resultDescription} />
            <PanelContent className="space-y-3">
              {!result ? (
                <EmptyState className="flex min-h-[24rem] items-center justify-center">输入关键词，或选择左侧快捷搜索。</EmptyState>
              ) : resultGames.length === 0 ? (
                <EmptyState className="flex min-h-[24rem] items-center justify-center">没有匹配条目。</EmptyState>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {resultGames.map((game) => <GameResultCard key={game.id} game={game} onOpen={() => onOpenGame?.(game.id)} />)}
                </div>
              )}
            </PanelContent>
          </Panel>
        </div>
      </PageFrame>
    </PageShell>
  );
}

function GameResultCard({ game, onOpen }: { game: Game; onOpen?: () => void }) {
  return (
    <SoftRow className="flex min-h-[9rem] gap-3 p-2.5">
      <CoverImage alt={game.title} className="h-32 w-[5.4rem] shrink-0 rounded-md" src={game.coverImage} />
      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 text-sm font-semibold text-slate-100">{game.title}</div>
        <div className="mt-1 text-xs text-slate-500">{game.developer || game.brand || '会社未填写'} · {game.releaseDate || '发售日未知'}</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge>{game.playStatus}</Badge>
          {game.rating != null && <Badge>{game.rating}</Badge>}
          <Badge>{formatPlayTime(game.totalPlaySeconds)}</Badge>
        </div>
        <div className="mt-2 line-clamp-2 text-xs text-slate-500">{game.description || game.notes || game.installPath}</div>
        <Button className="mt-3 h-7 px-2" size="sm" variant="secondary" onClick={onOpen}><PlayCircle className="h-4 w-4" />打开</Button>
      </div>
    </SoftRow>
  );
}
