import { Layers3, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CoverImage } from '@/components/ui/cover';
import { Input } from '@/components/ui/input';
import { EmptyState, Notice } from '@/components/ui/notice';
import { PageFrame, PageHeader, PageShell, Panel, SoftRow } from '@/components/ui/page';
import { Select } from '@/components/ui/select';
import { api } from '@/services/api';
import type { Game, GameCollection } from '@/types/game';
import { PLAY_STATUS_LABEL } from '@/types/game';
import { cn } from '@/utils/cn';
import { errorMessage } from '@/utils/errorMessage';

const colorOptions = [
  { id: 'rose', label: '樱粉' },
  { id: 'blue', label: '天蓝' },
  { id: 'teal', label: '青绿' },
  { id: 'amber', label: '琥珀' },
];

type CollectionsPageProps = {
  refreshKey: number;
  onOpenGame: (id: string) => void;
  onChanged: () => void;
};

export function CollectionsPage({ refreshKey, onOpenGame, onChanged }: CollectionsPageProps) {
  const [collections, setCollections] = useState<GameCollection[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('rose');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selected = useMemo(() => collections.find((item) => item.id === selectedId) ?? collections[0] ?? null, [collections, selectedId]);
  const linkedIds = useMemo(() => new Set(games.map((game) => game.id)), [games]);

  useEffect(() => {
    loadCollections();
  }, [refreshKey]);

  useEffect(() => {
    if (!selected) {
      setGames([]);
      return;
    }

    let cancelled = false;
    api
      .listCollectionGames(selected.id)
      .then((items) => {
        if (cancelled) return;
        setGames(items);
        setError(null);
      })
      .catch((reason) => {
        if (cancelled) return;
        setError(errorMessage(reason));
      });

    return () => {
      cancelled = true;
    };
  }, [selected?.id, refreshKey]);

  useEffect(() => {
    if (!selectedId && collections.length > 0) setSelectedId(collections[0].id);
    if (selectedId && collections.length > 0 && !collections.some((item) => item.id === selectedId)) setSelectedId(collections[0].id);
  }, [collections, selectedId]);

  const add = async () => {
    setError(null);
    setMessage(null);
    try {
      const collection = await api.createCollection({ name, description, color });
      setName('');
      setDescription('');
      setColor('rose');
      setCollections((current) => [collection, ...current.filter((item) => item.name !== collection.name)]);
      setSelectedId(collection.id);
      setMessage('合集已创建。可以在游戏库详情或此页把条目加入合集。');
      await loadCollections();
      onChanged();
    } catch (reason) {
      setError(errorMessage(reason));
    }
  };

  const removeCollection = async (collection: GameCollection) => {
    if (!window.confirm(`删除合集「${collection.name}」？这只删除合集关系，不会删除游戏记录，也不会删除真实游戏文件。`)) return;
    setError(null);
    try {
      await api.deleteCollection(collection.id);
      setSelectedId(null);
      await loadCollections();
      onChanged();
      setMessage('合集已删除，游戏记录未受影响。');
    } catch (reason) {
      setError(errorMessage(reason));
    }
  };

  const removeGame = async (game: Game) => {
    if (!selected) return;
    if (!window.confirm(`从合集「${selected.name}」移除「${game.title}」？只会移除合集关系，不会删除游戏记录，也不会删除真实游戏文件。`)) return;
    setError(null);
    try {
      await api.removeGameFromCollection(selected.id, game.id);
      setGames(await api.listCollectionGames(selected.id));
      await loadCollections();
      onChanged();
      setMessage('已从合集移除，游戏记录和真实文件未受影响。');
    } catch (reason) {
      setError(errorMessage(reason));
    }
  };

  return (
    <PageShell>
      <PageFrame className="max-w-[82rem] gap-5">
        <PageHeader
          title="合集"
          description="把喜欢的 VN 归成专题、系列、补票计划或自定义清单。"
          actions={<Badge>{collections.length} 个合集</Badge>}
        />
        {(error || message) && (
          <div className="space-y-2">
            {error && <Notice tone="error">{error}</Notice>}
            {message && <Notice>{message}</Notice>}
          </div>
        )}

        <div className="grid min-h-0 gap-4 lg:grid-cols-[20rem_1fr]">
          <Panel className="min-h-[34rem] overflow-hidden">
            <div className="border-b border-white/10 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-100"><Layers3 className="h-4 w-4 text-[rgb(var(--accent-rgb))]" />新建合集</div>
              <div className="space-y-2">
                <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="合集名称" />
                <Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="描述，可选" />
                <div className="flex gap-2">
                  <Select className="flex-1" value={color} onChange={(event) => setColor(event.target.value)}>
                    {colorOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </Select>
                  <Button onClick={add}><Plus className="h-4 w-4" />创建</Button>
                </div>
              </div>
            </div>

            <div className="max-h-[calc(100vh-18rem)] overflow-auto p-2.5">
              {collections.length === 0 ? <EmptyState className="py-10">还没有合集。</EmptyState> : collections.map((collection) => (
                <button
                  className={cn('motion-soft-row mb-1.5 w-full rounded-md border border-transparent px-3 py-3 text-left hover:bg-white/[0.07]', selected?.id === collection.id && 'border-[rgb(var(--accent-rgb)/0.28)] bg-white/[0.10]')}
                  key={collection.id}
                  onClick={() => setSelectedId(collection.id)}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-slate-100">{collection.name}</span>
                    <Badge className="min-h-5 px-2 text-[11px]">{collection.gameCount}</Badge>
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{collection.description || '暂无描述'}</div>
                </button>
              ))}
            </div>
          </Panel>

          <Panel className="min-h-[34rem] p-4">
            {!selected ? (
              <EmptyState className="h-full">选择或创建一个合集。</EmptyState>
            ) : (
              <div className="flex h-full min-h-0 flex-col gap-4">
                <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-lg font-semibold text-slate-100">{selected.name}</h2>
                      <Badge>{selected.gameCount} 个条目</Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{selected.description || '这个合集还没有描述。'}</p>
                  </div>
                  <Button variant="danger" size="sm" onClick={() => removeCollection(selected)}><Trash2 className="h-4 w-4" />删除合集</Button>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
                  <div className="min-h-0 space-y-2">
                    {games.length === 0 ? <EmptyState className="py-12">这个合集还没有游戏。</EmptyState> : games.map((game) => (
                      <SoftRow className="grid grid-cols-[3.4rem_1fr_auto] items-center gap-3 px-3 py-2" key={game.id}>
                        <CoverImage alt={game.title} className="aspect-[2/3] rounded-md" src={game.coverImage} />
                        <button className="min-w-0 text-left" onClick={() => onOpenGame(game.id)} type="button">
                          <div className="truncate text-sm font-medium text-slate-100">{game.title}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                            <Badge className="min-h-5 px-2 text-[11px]">{PLAY_STATUS_LABEL[game.playStatus]}</Badge>
                            <span className="truncate">{game.developer || game.brand || '未填写会社'}</span>
                          </div>
                        </button>
                        <Button size="sm" variant="outline" onClick={() => removeGame(game)}>移除</Button>
                      </SoftRow>
                    ))}
                  </div>

                  <AddGamesPanel collection={selected} linkedIds={linkedIds} onAdded={async () => {
                    setGames(await api.listCollectionGames(selected.id));
                    await loadCollections();
                    onChanged();
                  }} />
                </div>
              </div>
            )}
          </Panel>
        </div>
      </PageFrame>
    </PageShell>
  );

  async function loadCollections() {
    try {
      const items = await api.listCollections();
      setCollections(items);
      setError(null);
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }
}

function AddGamesPanel({ collection, linkedIds, onAdded }: { collection: GameCollection; linkedIds: Set<string>; onAdded: () => Promise<void> }) {
  const [query, setQuery] = useState('');
  const [games, setGames] = useState<Game[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    api.listGames({ query, sortBy: 'updated_at', sortDirection: 'desc', limit: 40 })
      .then((items) => {
        if (cancelled) return;
        setGames(items.filter((game) => !linkedIds.has(game.id)).slice(0, 8));
        setError(null);
      })
      .catch((reason) => {
        if (cancelled) return;
        setError(errorMessage(reason));
      });

    return () => {
      cancelled = true;
    };
  }, [query, linkedIds]);

  const add = async (gameId: string) => {
    setError(null);
    try {
      await api.addGameToCollection(collection.id, gameId);
      await onAdded();
    } catch (reason) {
      setError(errorMessage(reason));
    }
  };

  return (
    <div className="rounded-lg border border-white/10 bg-black/10 p-3">
      <div className="mb-2 text-sm font-medium text-slate-100">加入游戏</div>
      <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题 / 标签 / 会社" />
      {error && <Notice className="mt-2" tone="error">{error}</Notice>}
      <div className="mt-3 space-y-1.5">
        {games.length === 0 ? <div className="py-6 text-center text-xs text-slate-500">没有可加入的游戏。</div> : games.map((game) => (
          <button className="motion-soft-row flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left hover:bg-white/[0.07]" key={game.id} onClick={() => add(game.id)} type="button">
            <span className="min-w-0 truncate text-sm text-slate-200">{game.title}</span>
            <Plus className="h-4 w-4 shrink-0 text-[rgb(var(--accent-rgb))]" />
          </button>
        ))}
      </div>
    </div>
  );
}
