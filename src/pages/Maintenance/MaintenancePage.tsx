import { AlertTriangle, CheckCircle2, Combine, Database, FolderOpen, HardDrive, Image, ListChecks, PlayCircle, RefreshCw, ShieldCheck, Trash2, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { MetricTile, PageFrame, PageHeader, PageShell, Panel, PanelContent, PanelHeader, SoftRow } from '@/components/ui/page';
import { TaskNotice } from '@/components/ui/task-notice';
import { api } from '@/services/api';
import type { AppDataDiagnostics, ImageReferenceAudit, ImageReferenceAuditItem } from '@/types/archive';
import type { AssetCacheCleanupResult } from '@/types/game';
import type { DuplicateExternalIdGroup, DuplicateGameMergePreview } from '@/types/metadata';
import { errorMessage } from '@/utils/errorMessage';
import { Select } from '@/components/ui/select';

type TaskMessage = { text: string; taskId?: string | null };

export function MaintenancePage({ refreshKey, onOpenTasks }: { refreshKey: number; onOpenTasks?: (taskId?: string | null) => void }) {
  const [diagnostics, setDiagnostics] = useState<AppDataDiagnostics | null>(null);
  const [loading, setLoading] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [assetCleanupLoading, setAssetCleanupLoading] = useState(false);
  const [assetCleanupPreview, setAssetCleanupPreview] = useState<AssetCacheCleanupResult | null>(null);
  const [imageAudit, setImageAudit] = useState<ImageReferenceAudit | null>(null);
  const [imageAuditLoading, setImageAuditLoading] = useState(false);
  const [metadataRepairLoading, setMetadataRepairLoading] = useState(false);
  const [descriptionRepairLoading, setDescriptionRepairLoading] = useState(false);
  const [artworkRepairLoading, setArtworkRepairLoading] = useState(false);
  const [duplicateAuditLoading, setDuplicateAuditLoading] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateExternalIdGroup[]>([]);
  const [duplicateGroupsLoading, setDuplicateGroupsLoading] = useState(false);
  const [selectedDuplicateKey, setSelectedDuplicateKey] = useState('');
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [mergePreview, setMergePreview] = useState<DuplicateGameMergePreview | null>(null);
  const [mergeLoading, setMergeLoading] = useState(false);
  const [message, setMessage] = useState<TaskMessage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadDiagnostics();
  }, [refreshKey]);

  const database = diagnostics?.database;
  const metadata = database?.metadataCoverage;
  const descriptionImages = database?.descriptionImages;
  const externalIds = database?.externalIds;
  const pathStatus = database?.pathStatus;
  const providerDescriptionCoverage = useMemo(() => percent(descriptionImages?.providerGamesWithImagesCount ?? 0, descriptionImages?.providerGamesCount ?? 0), [descriptionImages]);
  const metadataCoverage = useMemo(() => percent(metadata?.completeGameCount ?? 0, database?.gameCount ?? 0), [database, metadata]);
  const issueCount = useMemo(() => {
    if (!database) return 0;
    return database.foreignKeyIssues
      + database.missingImageRefsCount
      + database.descriptionImages.missingLocalImageRefsCount
      + database.externalIds.duplicateExternalIdGroupsCount
      + database.pathStatus.brokenCount
      + database.cDriveImageRefsCount
      + database.playniteImageRefsCount;
  }, [database]);
  const selectedDuplicateGroup = useMemo(() => duplicateGroups.find((group) => duplicateGroupKey(group) === selectedDuplicateKey) ?? duplicateGroups[0] ?? null, [duplicateGroups, selectedDuplicateKey]);
  const mergeSourceIds = useMemo(() => selectedDuplicateGroup?.games.map((game) => game.gameId).filter((id) => id !== mergeTargetId) ?? [], [mergeTargetId, selectedDuplicateGroup]);

  useEffect(() => {
    if (!selectedDuplicateGroup) {
      setMergeTargetId('');
      setMergePreview(null);
      return;
    }
    if (!selectedDuplicateKey) setSelectedDuplicateKey(duplicateGroupKey(selectedDuplicateGroup));
    if (!mergeTargetId || !selectedDuplicateGroup.games.some((game) => game.gameId === mergeTargetId)) {
      setMergeTargetId(selectedDuplicateGroup.games[0]?.gameId ?? '');
    }
    setMergePreview(null);
  }, [mergeTargetId, selectedDuplicateGroup, selectedDuplicateKey]);

  return (
    <PageShell>
      <PageFrame className="max-w-[88rem] gap-5">
        <PageHeader
          title="维护中心"
          description="本机数据健康、媒体覆盖、重复风险和清理动作。"
          actions={(
            <>
              {onOpenTasks && <Button variant="ghost" onClick={() => onOpenTasks()}><ListChecks className="h-4 w-4" />任务</Button>}
              <Button disabled={loading} onClick={loadDiagnostics}><RefreshCw className="h-4 w-4" />{loading ? '刷新中' : '刷新'}</Button>
            </>
          )}
        />

        {(error || message) && (
          <div className="space-y-2">
            {error && <Notice className="py-2" tone="error">{error}</Notice>}
            {message && <TaskNotice message={message.text} taskId={message.taskId} onOpenTask={onOpenTasks} />}
          </div>
        )}

        {diagnostics?.warnings.length ? (
          <Notice tone="warning">
            <div className="flex flex-col gap-1 text-xs leading-5">
              {diagnostics.warnings.slice(0, 6).map((warning) => <span key={warning}>{warning}</span>)}
              {diagnostics.warnings.length > 6 && <span>还有 {diagnostics.warnings.length - 6} 条警告。</span>}
            </div>
          </Notice>
        ) : diagnostics ? (
          <Notice>
            <span className="inline-flex items-center gap-2 text-xs"><CheckCircle2 className="h-4 w-4 text-emerald-200" />当前自检没有发现高优先级警告。</span>
          </Notice>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile
            detail={database ? `quick_check: ${database.quickCheck ?? 'unknown'}` : '等待自检'}
            icon={database?.quickCheckOk ? <ShieldCheck className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            label="数据库"
            value={database ? database.quickCheckOk ? '正常' : '异常' : '未载入'}
          />
          <MetricTile
            detail={database ? `${formatCount(issueCount)} 个待关注项` : '等待自检'}
            icon={<Wrench className="h-4 w-4" />}
            label="维护状态"
            value={issueCount === 0 && database ? '干净' : formatCount(issueCount)}
          />
          <MetricTile
            detail={database ? `${formatCount(metadata?.completeGameCount ?? 0)} / ${formatCount(database.gameCount)} 条完整` : '等待自检'}
            icon={<Database className="h-4 w-4" />}
            label="元数据完整度"
            value={metadataCoverage}
          />
          <MetricTile
            detail={descriptionImages ? `${formatCount(descriptionImages.providerGamesWithImagesCount)} / ${formatCount(descriptionImages.providerGamesCount)} 个来源条目` : '等待自检'}
            icon={<Image className="h-4 w-4" />}
            label="简介图片覆盖"
            value={providerDescriptionCoverage}
          />
        </div>

        <Panel>
          <PanelHeader
            title="数据位置"
            description={diagnostics ? `来源：${dataDirSourceLabel(diagnostics.dataDirSource)}` : '当前 app-data 路径'}
            icon={<HardDrive className="h-4 w-4" />}
            actions={<Button disabled={cleanupLoading || !diagnostics?.databaseBackups.fileCount} size="sm" variant="ghost" onClick={cleanupDatabaseBackups}><Trash2 className="h-4 w-4" />{cleanupLoading ? '清理中' : '清理旧备份'}</Button>}
          />
          <PanelContent className="space-y-2">
            <PathRow label="数据目录" value={diagnostics?.appDataDir ?? '等待自检'} onReveal={diagnostics ? () => void revealPath(diagnostics.appDataDir) : undefined} />
            <PathRow label="数据库" value={database?.path ?? '等待自检'} onReveal={database ? () => void revealPath(database.path) : undefined} />
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              <StorageStat label="图片缓存" path={diagnostics?.images.path} size={diagnostics?.images.totalBytes ?? 0} count={diagnostics?.images.fileCount ?? 0} onReveal={diagnostics ? () => void revealPath(diagnostics.images.path) : undefined} />
              <StorageStat label="日志" path={diagnostics?.logs.path} size={diagnostics?.logs.totalBytes ?? 0} count={diagnostics?.logs.fileCount ?? 0} onReveal={diagnostics ? () => void revealPath(diagnostics.logs.path) : undefined} />
              <StorageStat label="存档备份" path={diagnostics?.saveBackups.path} size={diagnostics?.saveBackups.totalBytes ?? 0} count={diagnostics?.saveBackups.fileCount ?? 0} onReveal={diagnostics ? () => void revealPath(diagnostics.saveBackups.path) : undefined} />
              <StorageStat label="数据库备份" path={diagnostics?.databaseBackups.rootPath} size={diagnostics?.databaseBackups.totalBytes ?? 0} count={diagnostics?.databaseBackups.fileCount ?? 0} onReveal={diagnostics ? () => void revealPath(diagnostics.databaseBackups.rootPath) : undefined} />
            </div>
            <SoftRow className="grid gap-3 px-3 py-3 xl:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-100">
                  <span>图片缓存清理</span>
                  <Badge>先预览</Badge>
                </div>
                <div className="mt-1 text-xs leading-5 text-slate-500">只清理未被主图、媒体图库或简介本地图引用的 app-data/images 文件。</div>
                {assetCleanupPreview ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-4">
                    <CompactStat label="扫描文件" value={assetCleanupPreview.scannedFiles} />
                    <CompactStat label="可清理" value={assetCleanupPreview.removedFiles} tone={assetCleanupPreview.removedFiles > 0 ? 'warn' : 'ok'} />
                    <CompactStat label="可释放" value={formatBytes(assetCleanupPreview.removedBytes)} tone={assetCleanupPreview.removedBytes > 0 ? 'warn' : 'ok'} />
                    <CompactStat label="保留文件" value={assetCleanupPreview.keptFiles} />
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-slate-600">预览会扫描图片缓存，不会删除文件。</div>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap items-start gap-2 xl:justify-end">
                <Button disabled={assetCleanupLoading || !diagnostics} size="sm" variant="outline" onClick={previewAssetCacheCleanup}><ShieldCheck className="h-4 w-4" />{assetCleanupLoading ? '检查中' : '预览'}</Button>
                <Button disabled={assetCleanupLoading || !diagnostics || (assetCleanupPreview ? assetCleanupPreview.removedFiles === 0 : false)} size="sm" variant="danger" onClick={cleanupAssetCache}><Trash2 className="h-4 w-4" />{assetCleanupLoading ? '处理中' : '清理'}</Button>
              </div>
            </SoftRow>
          </PanelContent>
        </Panel>

        <div className="grid gap-5 xl:grid-cols-2">
          <Panel>
            <PanelHeader title="媒体与简介" description="封面、背景和简介图片的当前覆盖情况。" icon={<Image className="h-4 w-4" />} />
            <PanelContent className="space-y-4">
              <ProgressBlock label="DLsite / FANZA 简介图片" value={descriptionImages?.providerGamesWithImagesCount ?? 0} total={descriptionImages?.providerGamesCount ?? 0} />
              <div className="grid gap-2 sm:grid-cols-2">
                <CompactStat label="无简介图片" value={descriptionImages?.providerGamesWithoutImagesCount ?? 0} tone={(descriptionImages?.providerGamesWithoutImagesCount ?? 0) > 0 ? 'warn' : 'ok'} />
                <CompactStat label="空简介" value={descriptionImages?.providerGamesEmptyDescriptionCount ?? 0} tone={(descriptionImages?.providerGamesEmptyDescriptionCount ?? 0) > 0 ? 'warn' : 'ok'} />
                <CompactStat label="简介图片引用" value={descriptionImages?.imageRefsCount ?? 0} />
                <CompactStat label="缺失本地简介图" value={descriptionImages?.missingLocalImageRefsCount ?? 0} tone={(descriptionImages?.missingLocalImageRefsCount ?? 0) > 0 ? 'warn' : 'ok'} />
                <CompactStat label="缺封面" value={metadata?.missingCoverCount ?? 0} tone={(metadata?.missingCoverCount ?? 0) > 0 ? 'warn' : 'ok'} />
                <CompactStat label="缺背景" value={metadata?.missingBackgroundCount ?? 0} tone={(metadata?.missingBackgroundCount ?? 0) > 0 ? 'warn' : 'ok'} />
              </div>
            </PanelContent>
          </Panel>

          <Panel>
            <PanelHeader title="重复与完整度" description="外部 ID、基础元数据和路径状态。" icon={<Database className="h-4 w-4" />} />
            <PanelContent className="space-y-4">
              <ProgressBlock label="基础元数据完整" value={metadata?.completeGameCount ?? 0} total={database?.gameCount ?? 0} />
              <div className="grid gap-2 sm:grid-cols-2">
                <CompactStat label="需补元数据" value={metadata?.needsMetadataCount ?? 0} tone={(metadata?.needsMetadataCount ?? 0) > 0 ? 'warn' : 'ok'} />
                <CompactStat label="缺外部 ID" value={metadata?.missingExternalIdCount ?? 0} tone={(metadata?.missingExternalIdCount ?? 0) > 0 ? 'warn' : 'ok'} />
                <CompactStat label="重复 ID 组" value={externalIds?.duplicateExternalIdGroupsCount ?? 0} tone={(externalIds?.duplicateExternalIdGroupsCount ?? 0) > 0 ? 'warn' : 'ok'} />
                <CompactStat label="重复涉及游戏" value={externalIds?.duplicateExternalIdGamesCount ?? 0} tone={(externalIds?.duplicateExternalIdGamesCount ?? 0) > 0 ? 'warn' : 'ok'} />
                <CompactStat label="路径异常" value={pathStatus?.brokenCount ?? 0} tone={(pathStatus?.brokenCount ?? 0) > 0 ? 'warn' : 'ok'} />
                <CompactStat label="未检查路径" value={pathStatus?.uncheckedCount ?? 0} />
              </div>
            </PanelContent>
          </Panel>
        </div>

        <Panel>
          <PanelHeader
            title="图片引用问题"
            description="定位缺失、C 盘残留和 Playnite 残留图片引用。"
            icon={<Image className="h-4 w-4" />}
            actions={<Button disabled={imageAuditLoading || !diagnostics} size="sm" variant="ghost" onClick={loadImageAudit}><ListChecks className="h-4 w-4" />{imageAuditLoading ? '读取中' : '读取明细'}</Button>}
          />
          <PanelContent className="space-y-3">
            {imageAudit ? (
              <>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                  <CompactStat label="图片引用" value={imageAudit.totalRefs} />
                  <CompactStat label="问题引用" value={imageAudit.issueCount} tone={imageAudit.issueCount > 0 ? 'warn' : 'ok'} />
                  <CompactStat label="缺失本地文件" value={imageAudit.missingCount} tone={imageAudit.missingCount > 0 ? 'warn' : 'ok'} />
                  <CompactStat label="C 盘残留" value={imageAudit.cDriveCount} tone={imageAudit.cDriveCount > 0 ? 'warn' : 'ok'} />
                  <CompactStat label="Playnite 残留" value={imageAudit.playniteCount} tone={imageAudit.playniteCount > 0 ? 'warn' : 'ok'} />
                </div>
                {imageAudit.items.length > 0 ? (
                  <div className="space-y-2">
                    {imageAudit.items.map((item, index) => <ImageAuditRow item={item} key={`${item.gameId ?? 'game'}-${item.sourceKind}-${item.fieldName ?? 'field'}-${item.value}-${index}`} />)}
                    {imageAudit.truncated && <div className="px-1 text-xs text-slate-500">结果较多，当前只显示前 80 条问题引用。</div>}
                  </div>
                ) : (
                  <SoftRow className="px-3 py-3 text-sm text-slate-400">没有发现需要处理的图片引用。</SoftRow>
                )}
              </>
            ) : (
              <SoftRow className="flex items-center justify-between gap-3 px-3 py-3">
                <div className="min-w-0 text-sm text-slate-400">读取后会列出具体游戏、来源字段、原始路径和已解析到的文件路径。</div>
                <Button disabled={imageAuditLoading || !diagnostics} size="sm" variant="secondary" onClick={loadImageAudit}><ListChecks className="h-4 w-4" />读取</Button>
              </SoftRow>
            )}
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader
            title="重复游戏安全合并"
            description="只允许合并共享外部 ID 的条目，执行前会预览搬迁数据。"
            icon={<Combine className="h-4 w-4" />}
            actions={<Button disabled={duplicateGroupsLoading} size="sm" variant="ghost" onClick={() => loadDuplicateGroups()}><RefreshCw className="h-4 w-4" />{duplicateGroupsLoading ? '读取中' : '读取重复组'}</Button>}
          />
          <PanelContent className="space-y-3">
            {duplicateGroups.length === 0 ? (
              <SoftRow className="flex items-center justify-between gap-3 px-3 py-3">
                <div className="min-w-0 text-sm text-slate-400">还没有载入重复组。先读取重复组，或运行重复 ID 审查后再回来处理。</div>
                <Button disabled={duplicateGroupsLoading || (externalIds?.duplicateExternalIdGroupsCount ?? 0) === 0} size="sm" variant="secondary" onClick={() => loadDuplicateGroups()}><ListChecks className="h-4 w-4" />读取</Button>
              </SoftRow>
            ) : (
              <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                <div className="space-y-2">
                  <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(12rem,18rem)]">
                    <label className="min-w-0 text-xs text-slate-500">
                      重复组
                      <Select className="mt-1 w-full" value={selectedDuplicateKey} onChange={(event) => { setSelectedDuplicateKey(event.target.value); setMergePreview(null); }}>
                        {duplicateGroups.map((group) => (
                          <option key={duplicateGroupKey(group)} value={duplicateGroupKey(group)}>{group.provider} {group.externalId} · {group.gameCount} 条</option>
                        ))}
                      </Select>
                    </label>
                    <label className="min-w-0 text-xs text-slate-500">
                      保留为目标
                      <Select className="mt-1 w-full" value={mergeTargetId} onChange={(event) => { setMergeTargetId(event.target.value); setMergePreview(null); }}>
                        {selectedDuplicateGroup?.games.map((game) => <option key={game.gameId} value={game.gameId}>{game.title}</option>)}
                      </Select>
                    </label>
                  </div>
                  <div className="space-y-2">
                    {selectedDuplicateGroup?.games.map((game) => (
                      <SoftRow className="grid gap-2 px-3 py-2 md:grid-cols-[minmax(0,1fr)_auto]" key={game.gameId}>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-medium text-slate-100">{game.title}</span>
                            {game.gameId === mergeTargetId ? <Badge>保留</Badge> : <Badge>并入</Badge>}
                          </div>
                          <div className="mt-1 break-all font-mono text-[11px] text-slate-600">{game.installPath}</div>
                        </div>
                        <div className="text-right text-[11px] text-slate-500">{game.sources.join(' / ')}</div>
                      </SoftRow>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Button disabled={mergeLoading || !mergeTargetId || mergeSourceIds.length === 0} size="sm" variant="secondary" onClick={previewDuplicateMerge}><ShieldCheck className="h-4 w-4" />{mergeLoading && !mergePreview ? '预览中' : '预览合并'}</Button>
                    <Button disabled={mergeLoading || !mergePreview || mergeSourceIds.length === 0} size="sm" variant="danger" onClick={mergeDuplicateGroup}><Combine className="h-4 w-4" />{mergeLoading && mergePreview ? '合并中' : '确认合并'}</Button>
                  </div>
                  {mergePreview ? (
                    <div className="space-y-2">
                      <SoftRow className="px-3 py-2">
                        <div className="text-xs text-slate-500">共享外部 ID</div>
                        <div className="mt-1 text-sm text-slate-200">{mergePreview.sharedExternalIds.map((item) => `${item.provider} ${item.externalId}`).join('，')}</div>
                      </SoftRow>
                      <div className="grid grid-cols-2 gap-2">
                        <CompactStat label="删除源条目" value={mergePreview.movedCounts.sourceGames} tone="warn" />
                        <CompactStat label="搬迁资产" value={mergePreview.movedCounts.assets} />
                        <CompactStat label="收藏关系" value={mergePreview.movedCounts.collectionLinks} />
                        <CompactStat label="启动配置" value={mergePreview.movedCounts.launchProfiles} />
                        <CompactStat label="存档路径" value={mergePreview.movedCounts.savePaths} />
                        <CompactStat label="游玩记录" value={mergePreview.movedCounts.playSessions} />
                      </div>
                      {mergePreview.warnings.length > 0 && (
                        <Notice className="py-2" tone="warning">
                          <div className="flex flex-col gap-1 text-xs leading-5">
                            {mergePreview.warnings.slice(0, 4).map((warning) => <span key={warning}>{warning}</span>)}
                          </div>
                        </Notice>
                      )}
                    </div>
                  ) : (
                    <SoftRow className="px-3 py-3 text-xs leading-5 text-slate-500">预览后会显示将要移动的收藏、资产、标签、启动配置、存档和游玩记录数量。</SoftRow>
                  )}
                </div>
              </div>
            )}
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader title="维护队列" description="已落地的统计基础和下一批整理入口。" icon={<ListChecks className="h-4 w-4" />} />
          <PanelContent className="grid gap-2 xl:grid-cols-4">
            <MaintenanceAction
              action={(
                <Button disabled={descriptionRepairLoading || ((descriptionImages?.providerGamesWithoutImagesCount ?? 0) + (descriptionImages?.providerGamesEmptyDescriptionCount ?? 0)) === 0} size="sm" variant="secondary" onClick={startDescriptionImageRepair}>
                  <PlayCircle className="h-4 w-4" />{descriptionRepairLoading ? '创建中' : '开始'}
                </Button>
              )}
              detail={`${formatCount((descriptionImages?.providerGamesWithoutImagesCount ?? 0) + (descriptionImages?.providerGamesEmptyDescriptionCount ?? 0))} 个条目待补简介图片`}
              label="简介图片修复"
              status="可创建任务"
            />
            <MaintenanceAction
              action={(
                <Button disabled={artworkRepairLoading || ((metadata?.missingCoverCount ?? 0) + (metadata?.missingBackgroundCount ?? 0)) === 0} size="sm" variant="secondary" onClick={startArtworkRepair}>
                  <PlayCircle className="h-4 w-4" />{artworkRepairLoading ? '创建中' : '开始'}
                </Button>
              )}
              detail={`${formatCount((metadata?.missingCoverCount ?? 0) + (metadata?.missingBackgroundCount ?? 0))} 个媒体字段待补`}
              label="媒体图片补全"
              status="可创建任务"
            />
            <MaintenanceAction
              action={(
                <Button disabled={duplicateAuditLoading || (externalIds?.duplicateExternalIdGroupsCount ?? 0) === 0} size="sm" variant="secondary" onClick={startDuplicateExternalIdAudit}>
                  <PlayCircle className="h-4 w-4" />{duplicateAuditLoading ? '创建中' : '开始'}
                </Button>
              )}
              detail={`${formatCount(externalIds?.duplicateExternalIdGroupsCount ?? 0)} 组重复外部 ID`}
              label="重复 ID 审查"
              status="可创建任务"
            />
            <MaintenanceAction
              action={(
                <Button disabled={metadataRepairLoading || (metadata?.needsMetadataCount ?? 0) === 0} size="sm" variant="secondary" onClick={startMetadataRepair}>
                  <PlayCircle className="h-4 w-4" />{metadataRepairLoading ? '创建中' : '开始'}
                </Button>
              )}
              detail={`${formatCount(metadata?.needsMetadataCount ?? 0)} 个条目可批量匹配元数据`}
              label="批量元数据匹配"
              status="可创建任务"
            />
          </PanelContent>
        </Panel>
      </PageFrame>
    </PageShell>
  );

  async function loadDiagnostics() {
    setLoading(true);
    setError(null);
    try {
      setDiagnostics(await api.getAppDataDiagnostics());
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }

  async function loadImageAudit() {
    setImageAuditLoading(true);
    setError(null);
    try {
      const audit = await api.auditImageReferences({ limit: 80, includeOk: false });
      setImageAudit(audit);
      setMessage({ text: audit.issueCount > 0 ? `图片引用审计完成：发现 ${formatCount(audit.issueCount)} 条问题引用。` : '图片引用审计完成，没有发现问题引用。' });
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setImageAuditLoading(false);
    }
  }

  async function cleanupDatabaseBackups() {
    if (!window.confirm('按安全规则清理旧数据库备份？会保留最近 10 个和 30 天内备份，不会删除当前 mikavn.db。')) return;
    setCleanupLoading(true);
    setError(null);
    setMessage(null);
    try {
      const report = await api.cleanupOldDatabaseBackups({ retainCount: 10, retainDays: 30 });
      setMessage({ text: report.removedFiles > 0 ? `已清理 ${report.removedFiles} 个旧数据库备份，释放 ${formatBytes(report.removedBytes)}。` : '没有需要清理的旧数据库备份。' });
      await loadDiagnostics();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setCleanupLoading(false);
    }
  }

  async function previewAssetCacheCleanup() {
    setAssetCleanupLoading(true);
    setError(null);
    setMessage(null);
    try {
      const result = await api.previewAssetCacheCleanup();
      setAssetCleanupPreview(result);
      setMessage({ text: result.removedFiles > 0 ? `图片缓存预览完成：可清理 ${formatCount(result.removedFiles)} 个文件，预计释放 ${formatBytes(result.removedBytes)}。` : '图片缓存预览完成，没有发现可清理文件。' });
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setAssetCleanupLoading(false);
    }
  }

  async function cleanupAssetCache() {
    setError(null);
    setMessage(null);
    let preview = assetCleanupPreview;
    if (!preview) {
      setAssetCleanupLoading(true);
      try {
        preview = await api.previewAssetCacheCleanup();
        setAssetCleanupPreview(preview);
      } catch (reason) {
        setError(errorMessage(reason));
        setAssetCleanupLoading(false);
        return;
      }
      setAssetCleanupLoading(false);
    }

    if (preview.removedFiles === 0) {
      setMessage({ text: '没有需要清理的图片缓存文件。' });
      return;
    }
    if (!window.confirm(`清理 ${formatCount(preview.removedFiles)} 个未引用图片缓存文件，预计释放 ${formatBytes(preview.removedBytes)}？`)) return;

    setAssetCleanupLoading(true);
    try {
      const result = await api.cleanupAssetCache();
      setMessage({ text: result.removedFiles > 0 ? `已清理 ${formatCount(result.removedFiles)} 个图片缓存文件，释放 ${formatBytes(result.removedBytes)}。` : '没有需要清理的图片缓存文件。' });
      setAssetCleanupPreview(await api.previewAssetCacheCleanup());
      await loadDiagnostics();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setAssetCleanupLoading(false);
    }
  }

  async function startMetadataRepair() {
    setMetadataRepairLoading(true);
    setError(null);
    setMessage(null);
    try {
      const candidates = await api.listGames({ metadataStatus: 'needs_metadata', sortBy: 'updated_at', sortDirection: 'desc' });
      const gameIds = candidates.map((game) => game.id);
      if (gameIds.length === 0) {
        setMessage({ text: '没有需要批量匹配元数据的条目。' });
        await loadDiagnostics();
        return;
      }
      const job = await api.batchMatchMetadata(gameIds);
      const text = `已创建批量元数据匹配任务：${formatCount(gameIds.length)} 个条目。`;
      setMessage({ text, taskId: job.taskId ?? null });
      if (job.taskId) onOpenTasks?.(job.taskId);
      await loadDiagnostics();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setMetadataRepairLoading(false);
    }
  }

  async function startDescriptionImageRepair() {
    setDescriptionRepairLoading(true);
    setError(null);
    setMessage(null);
    try {
      const preview = await api.previewDescriptionImageRepair({ provider: 'all', limit: 20, maxImages: 3 });
      if (preview.totalCandidates === 0) {
        setMessage({ text: '没有需要修复简介图片的条目。' });
        await loadDiagnostics();
        return;
      }
      const task = await api.repairDescriptionImages({ provider: 'all', limit: 20, maxImages: 3 });
      setMessage({ text: `已创建简介图片修复任务：本轮 ${formatCount(preview.candidates.length)} 个条目。`, taskId: task.id });
      onOpenTasks?.(task.id);
      await loadDiagnostics();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setDescriptionRepairLoading(false);
    }
  }

  async function startArtworkRepair() {
    setArtworkRepairLoading(true);
    setError(null);
    setMessage(null);
    try {
      const options = { providers: ['all'], fields: ['cover', 'background'], limit: 20 };
      const preview = await api.previewArtworkRepair(options);
      if (preview.totalCandidates === 0) {
        setMessage({ text: '没有可补全媒体图片的条目。' });
        await loadDiagnostics();
        return;
      }
      const task = await api.repairArtwork(options);
      setMessage({ text: `已创建媒体图片补全任务：本轮 ${formatCount(preview.candidates.length)} 个条目，${formatCount(preview.totalMissingFields)} 个字段。`, taskId: task.id });
      onOpenTasks?.(task.id);
      await loadDiagnostics();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setArtworkRepairLoading(false);
    }
  }

  async function startDuplicateExternalIdAudit() {
    setDuplicateAuditLoading(true);
    setError(null);
    setMessage(null);
    try {
      const preview = await api.previewDuplicateExternalIds({ providers: ['all'], limit: 50 });
      if (preview.totalGroups === 0) {
        setMessage({ text: '没有发现重复外部 ID。' });
        await loadDiagnostics();
        return;
      }
      const task = await api.auditDuplicateExternalIds({ providers: ['all'], limit: 50 });
      setMessage({ text: `已创建重复 ID 审查任务：${formatCount(preview.totalGroups)} 组，涉及 ${formatCount(preview.totalGames)} 个游戏。`, taskId: task.id });
      onOpenTasks?.(task.id);
      await loadDiagnostics();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setDuplicateAuditLoading(false);
    }
  }

  async function loadDuplicateGroups(announceEmpty = true) {
    setDuplicateGroupsLoading(true);
    setError(null);
    try {
      const preview = await api.previewDuplicateExternalIds({ providers: ['all'], limit: 50 });
      setDuplicateGroups(preview.groups);
      const first = preview.groups[0] ?? null;
      setSelectedDuplicateKey(first ? duplicateGroupKey(first) : '');
      setMergeTargetId(first?.games[0]?.gameId ?? '');
      setMergePreview(null);
      if (announceEmpty && preview.totalGroups === 0) setMessage({ text: '没有发现可合并的重复外部 ID 组。' });
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setDuplicateGroupsLoading(false);
    }
  }

  async function previewDuplicateMerge() {
    if (!selectedDuplicateGroup || !mergeTargetId || mergeSourceIds.length === 0) return;
    setMergeLoading(true);
    setError(null);
    setMessage(null);
    try {
      const preview = await api.previewDuplicateGameMerge({ targetGameId: mergeTargetId, sourceGameIds: mergeSourceIds });
      setMergePreview(preview);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setMergeLoading(false);
    }
  }

  async function mergeDuplicateGroup() {
    if (!mergePreview || !selectedDuplicateGroup || !mergeTargetId || mergeSourceIds.length === 0) return;
    const target = selectedDuplicateGroup.games.find((game) => game.gameId === mergeTargetId);
    if (!window.confirm(`把 ${mergeSourceIds.length} 条重复游戏并入「${target?.title ?? mergeTargetId}」？源游戏记录会删除，但关联数据会先迁移。`)) return;
    setMergeLoading(true);
    setError(null);
    setMessage(null);
    try {
      const result = await api.mergeDuplicateGames({ targetGameId: mergeTargetId, sourceGameIds: mergeSourceIds });
      const successText = `已合并重复游戏：删除 ${formatCount(result.deletedSourceGameIds.length)} 条源记录，保留「${result.mergedGame.title}」。`;
      setMessage({ text: successText });
      setMergePreview(null);
      await loadDiagnostics();
      await loadDuplicateGroups(false);
      setMessage({ text: successText });
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setMergeLoading(false);
    }
  }

  async function revealPath(path: string) {
    setError(null);
    try {
      await api.revealPath(path);
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }
}

function PathRow({ label, value, onReveal }: { label: string; value: string; onReveal?: () => void }) {
  return (
    <SoftRow className="grid gap-2 px-3 py-2 lg:grid-cols-[5rem_minmax(0,1fr)_auto]">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="min-w-0 break-all font-mono text-xs text-slate-300">{value}</div>
      {onReveal ? <Button aria-label={`打开${label}`} size="icon" title={`打开${label}`} variant="ghost" onClick={onReveal}><FolderOpen className="h-4 w-4" /></Button> : <span />}
    </SoftRow>
  );
}

function StorageStat({ label, count, size, path, onReveal }: { label: string; count: number; size: number; path?: string; onReveal?: () => void }) {
  return (
    <SoftRow className="flex items-start justify-between gap-3 px-3 py-2">
      <div className="min-w-0">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="mt-1 font-mono text-sm text-slate-200">{formatCount(count)} · {formatBytes(size)}</div>
        {path && <div className="mt-1 truncate font-mono text-[11px] text-slate-600" title={path}>{path}</div>}
      </div>
      {onReveal && <Button aria-label={`打开${label}`} size="icon" title={`打开${label}`} variant="ghost" onClick={onReveal}><FolderOpen className="h-4 w-4" /></Button>}
    </SoftRow>
  );
}

function ImageAuditRow({ item }: { item: ImageReferenceAuditItem }) {
  const title = item.gameTitle?.trim() || item.gameId || '未知游戏';
  const issues = item.issues.length > 0 ? item.issues : [item.status];
  return (
    <SoftRow className="grid gap-3 px-3 py-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium text-slate-100" title={title}>{title}</span>
          <Badge>{item.sourceLabel}</Badge>
          {item.fieldName && <Badge>{imageFieldLabel(item.fieldName)}</Badge>}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {issues.map((issue) => <Badge className={imageBadgeClass(issue)} key={issue}>{imageIssueLabel(issue)}</Badge>)}
        </div>
      </div>
      <div className="min-w-0 space-y-1 text-[11px] leading-5">
        <div className="grid gap-1 sm:grid-cols-[4.5rem_minmax(0,1fr)]">
          <span className="text-slate-600">原始值</span>
          <span className="break-all font-mono text-slate-300">{item.value}</span>
        </div>
        {item.resolvedPath && (
          <div className="grid gap-1 sm:grid-cols-[4.5rem_minmax(0,1fr)]">
            <span className="text-slate-600">解析路径</span>
            <span className="break-all font-mono text-slate-500">{item.resolvedPath}</span>
          </div>
        )}
      </div>
    </SoftRow>
  );
}

function ProgressBlock({ label, value, total }: { label: string; value: number; total: number }) {
  const ratio = total > 0 ? Math.max(0, Math.min(100, (value / total) * 100)) : 0;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="font-mono text-slate-200">{formatCount(value)} / {formatCount(total)} · {percent(value, total)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/25">
        <div className="h-full rounded-full bg-[rgb(var(--accent-rgb))]" style={{ width: `${ratio}%` }} />
      </div>
    </div>
  );
}

function CompactStat({ label, value, tone = 'neutral' }: { label: string; value: number | string; tone?: 'neutral' | 'ok' | 'warn' }) {
  const toneClass = tone === 'ok' ? 'text-emerald-200' : tone === 'warn' ? 'text-amber-200' : 'text-slate-200';
  const displayValue = typeof value === 'number' ? formatCount(value) : value;
  return (
    <div className="rounded-md border border-white/10 bg-black/[0.10] px-3 py-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={`mt-1 font-mono text-sm ${toneClass}`}>{displayValue}</div>
    </div>
  );
}

function MaintenanceAction({ action, label, detail, status }: { action?: ReactNode; label: string; detail: string; status: string }) {
  return (
    <SoftRow className="flex items-center justify-between gap-3 px-3 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-slate-100">{label}</div>
        <div className="mt-1 text-xs text-slate-500">{detail}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge>{status}</Badge>
        {action}
      </div>
    </SoftRow>
  );
}

function formatCount(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? Math.round(size) : size.toFixed(size >= 10 ? 1 : 2)} ${units[unit]}`;
}

function percent(value: number, total: number) {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}

function duplicateGroupKey(group: DuplicateExternalIdGroup) {
  return `${group.provider}:${group.externalId}`;
}

function imageIssueLabel(value: string) {
  if (value === 'missing') return '缺失';
  if (value === 'c_drive') return 'C 盘';
  if (value === 'playnite') return 'Playnite';
  if (value === 'remote') return '远程';
  if (value === 'ok') return '正常';
  if (value === 'warning') return '警告';
  return value;
}

function imageFieldLabel(value: string) {
  if (value === 'cover_image' || value === 'coverImage') return '封面字段';
  if (value === 'banner_image' || value === 'bannerImage') return '横幅字段';
  if (value === 'background_image' || value === 'backgroundImage') return '背景字段';
  if (value === 'description') return '简介';
  if (value === 'game_assets.uri') return '图库 URI';
  return value;
}

function imageBadgeClass(value: string) {
  if (value === 'missing') return 'border-amber-300/25 bg-amber-300/10 text-amber-100';
  if (value === 'c_drive' || value === 'playnite') return 'border-rose-300/25 bg-rose-300/10 text-rose-100';
  if (value === 'ok' || value === 'remote') return 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100';
  return 'border-white/10 bg-white/[0.045] text-slate-300';
}

function dataDirSourceLabel(value: string) {
  if (value === 'env') return 'MIKAVN_APP_DATA_DIR';
  if (value === 'portable') return '应用旁 app-data';
  if (value === 'mock') return '浏览器预览';
  return '应用默认目录';
}
