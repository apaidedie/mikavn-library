import { Layers3, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Select } from '@/components/ui/select';
import { api } from '@/services/api';
import type { Game, GameCollection } from '@/types/game';
import { errorMessage } from '@/utils/errorMessage';

export function GameCollectionsPanel({ game, onEdit }: { game: Game; onEdit: () => void }) {
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
