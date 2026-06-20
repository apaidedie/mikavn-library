import { CalendarDays, Clock3, Edit3, Play, Star, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CoverImage } from '@/components/ui/cover';
import type { Game } from '@/types/game';
import { PLAY_STATUS_LABEL } from '@/types/game';
import type { LaunchProfile } from '@/types/launch';
import { cn } from '@/utils/cn';
import { imageSrc } from '@/utils/imageSrc';
import { formatDateTime, formatPlayTime } from '@/utils/time';
import { HeaderRecordCard } from './GameDetailParts';

type GameDetailHeroProps = {
  blurCover: boolean;
  game: Game;
  selectedProfile?: LaunchProfile;
  onEdit: (game: Game) => void;
  onLaunch: () => void;
  onRemove: () => void;
};

export function GameDetailHero({ blurCover, game, onEdit, onLaunch, onRemove, selectedProfile }: GameDetailHeroProps) {
  const heroImage = imageSrc(game.backgroundImage || game.bannerImage || game.coverImage);

  return (
    <>
      {heroImage && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <img alt="" className={cn('absolute inset-x-0 top-0 h-[520px] w-full object-cover opacity-55', blurCover && 'scale-105 blur-md')} decoding="async" loading="eager" src={heroImage} />
          <div className="absolute inset-x-0 top-0 h-[560px] bg-[linear-gradient(180deg,rgba(29,36,47,0.12),rgb(var(--app-bg-rgb))_86%),linear-gradient(90deg,rgb(var(--app-bg-rgb))_0%,rgb(var(--app-bg-rgb)/0.78)_32%,rgb(var(--app-bg-rgb)/0.34)_70%,rgb(var(--app-bg-rgb)/0.72)_100%)]" />
          <div className="absolute inset-0 bg-[rgb(var(--app-bg-rgb)/0.34)]" />
        </div>
      )}

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
                <Button className="h-10 w-[170px] rounded-lg shadow-lg shadow-black/25" disabled={!selectedProfile} onClick={onLaunch}><Play className="h-4 w-4 fill-current" />启动</Button>
                <Button variant="secondary" onClick={() => onEdit(game)}><Edit3 className="h-4 w-4" />编辑</Button>
                <Button aria-label="删除记录" className="w-9 px-0" title="删除记录" variant="ghost" onClick={onRemove}><Trash2 className="h-4 w-4 text-rose-200" /></Button>
              </div>
            </div>
            <CoverImage alt={game.title} blur={blurCover} className="aspect-[2/3] h-[170px] shrink-0 rounded-lg shadow-2xl shadow-black/45 ring-1 ring-white/10" loading="eager" src={game.coverImage} />
          </div>

          <div className="flex flex-wrap items-center gap-12 pl-1 pt-3">
            <HeaderRecordCard icon={<Clock3 className="h-7 w-7" />} label="游玩时间" value={formatPlayTime(game.totalPlaySeconds)} />
            <HeaderRecordCard icon={<CalendarDays className="h-7 w-7" />} label="最近游玩" value={formatDateTime(game.lastPlayedAt)} />
            <HeaderRecordCard icon={<Play className="h-7 w-7" />} label="游玩状态" value={PLAY_STATUS_LABEL[game.playStatus]} />
            <HeaderRecordCard icon={<Star className="h-7 w-7" />} label="评分" value={game.rating ? `${game.rating}/100` : '暂无'} />
          </div>
        </div>
      </div>
    </>
  );
}
