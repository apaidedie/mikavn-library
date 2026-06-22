import type { ImageReferenceAudit, ImageReferenceAuditItem, ImageReferenceAuditOptions } from '@/types/archive';
import type { Game, GameAsset } from '@/types/game';

function mockDescriptionImageSources(value?: string | null) {
  const pattern = /!\[[^\]]*\]\(([^)]*?)\)|<img\b[^>]*>|\[img\]([\s\S]*?)\[\/img\]|https?:\/\/[^\s<>"']+?\.(?:png|jpe?g|webp|gif)(?:\?[^\s<>"']*)?/gi;
  return [...(value ?? '').matchAll(pattern)]
    .map((match) => {
      if (match[1]) return match[1].trim();
      if (match[2]) return match[2].trim();
      const token = match[0];
      if (token.toLowerCase().startsWith('<img')) {
        const src = token.match(/\b(?:src|data-src|data-original|data-lazy-src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
        return (src?.[1] ?? src?.[2] ?? src?.[3] ?? '').trim();
      }
      return token.trim().replace(/[),，。.;；]+$/g, '');
    })
    .filter(Boolean);
}

function mockAuditImageValue(value: string, imageDir: string, sampleHeroUrl: string) {
  const clean = value.trim();
  const lower = clean.toLowerCase().replace(/\//g, '\\');
  const remote = /^https?:\/\//i.test(clean);
  const embedded = clean.startsWith('data:') || clean.startsWith('asset:') || clean === sampleHeroUrl || clean.startsWith('/assets/');
  const local = clean !== '' && !remote && !embedded;
  const issues: string[] = [];
  if (local && !clean.startsWith(`${imageDir}\\`) && !clean.startsWith('images\\') && !clean.startsWith('images/')) issues.push('missing');
  if (lower.startsWith('c:\\')) issues.push('c_drive');
  if (lower.includes('\\playnite\\') || lower.startsWith('d:\\playnite')) issues.push('playnite');
  return {
    local,
    remote,
    status: issues.includes('missing') ? 'missing' : issues.length > 0 ? 'warning' : remote ? 'remote' : 'ok',
    issues,
    resolvedPath: local && issues.length === 0 ? clean : null,
  };
}

export function mockImageReferenceAudit(
  options: ImageReferenceAuditOptions = {},
  context: { assets: GameAsset[]; games: Game[]; imageDir: string; sampleHeroUrl: string }
): ImageReferenceAudit {
  const refs: ImageReferenceAuditItem[] = [];
  const push = (item: Omit<ImageReferenceAuditItem, 'status' | 'issues' | 'resolvedPath'>) => {
    const audit = mockAuditImageValue(item.value, context.imageDir, context.sampleHeroUrl);
    refs.push({ ...item, status: audit.status, issues: audit.issues, resolvedPath: audit.resolvedPath });
  };
  for (const game of context.games) {
    ([['coverImage', '封面', game.coverImage], ['bannerImage', '横幅', game.bannerImage], ['backgroundImage', '背景', game.backgroundImage]] as const)
      .forEach(([fieldName, sourceLabel, value]) => {
        if (!value?.trim()) return;
        push({ gameId: game.id, gameTitle: game.title, sourceKind: 'game_field', sourceLabel, fieldName, value });
      });
    for (const source of mockDescriptionImageSources(game.description)) {
      push({ gameId: game.id, gameTitle: game.title, sourceKind: 'description', sourceLabel: '简介图片', fieldName: 'description', value: source });
    }
  }
  for (const asset of context.assets) {
    const game = context.games.find((item) => item.id === asset.gameId);
    push({ gameId: asset.gameId, gameTitle: game?.title ?? null, sourceKind: 'game_asset', sourceLabel: asset.assetType || '媒体图库', fieldName: 'game_assets.uri', value: asset.uri });
  }

  const limit = Math.max(1, Math.min(Number(options.limit ?? 200) || 200, 1000));
  const includeOk = Boolean(options.includeOk);
  const gameId = options.gameId?.trim();
  const scopedRefs = gameId ? refs.filter((item) => item.gameId === gameId) : refs;
  const filtered = scopedRefs.filter((item) => includeOk || item.issues.length > 0);
  return {
    totalRefs: scopedRefs.length,
    issueCount: scopedRefs.filter((item) => item.issues.length > 0).length,
    localCount: scopedRefs.filter((item) => mockAuditImageValue(item.value, context.imageDir, context.sampleHeroUrl).local).length,
    remoteCount: scopedRefs.filter((item) => mockAuditImageValue(item.value, context.imageDir, context.sampleHeroUrl).remote).length,
    missingCount: scopedRefs.filter((item) => item.issues.includes('missing')).length,
    cDriveCount: scopedRefs.filter((item) => item.issues.includes('c_drive')).length,
    playniteCount: scopedRefs.filter((item) => item.issues.includes('playnite')).length,
    items: filtered.slice(0, limit),
    truncated: filtered.length > limit,
  };
}
