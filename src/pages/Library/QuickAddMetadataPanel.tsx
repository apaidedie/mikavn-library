import { DatabaseZap, FolderSearch, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CoverImage } from '@/components/ui/cover';
import type { MetadataSearchResult } from '@/types/metadata';
import { cn } from '@/utils/cn';
import { candidateKey, deriveGameFormMetadataBadges, providerLabel, type GameFormState } from './gameFormMapping';

type QuickAddMetadataPanelProps = {
  canScrape: boolean;
  form: GameFormState;
  scraping: boolean;
  scrapeCandidates: MetadataSearchResult[];
  scrapeMessage: string | null;
  selectedCandidateKey: string | null;
  onRescrape: () => void;
  onSelectCandidate: (candidate: MetadataSearchResult) => void;
};

export function QuickAddMetadataPanel({ canScrape, form, onRescrape, onSelectCandidate, scrapeCandidates, scrapeMessage, scraping, selectedCandidateKey }: QuickAddMetadataPanelProps) {
  const hasMetadataPreview = Boolean(form.coverImage || form.developer || form.publisher || form.releaseDate || form.vndbId || form.dlsiteId || form.fanzaId || form.tags);
  const metadataBadges = deriveGameFormMetadataBadges(form);

  return (
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
              <Button disabled={!canScrape} size="sm" type="button" variant="secondary" onClick={onRescrape}>
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
                      onClick={() => onSelectCandidate(candidate)}
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
  );
}
