import { PageFrame, PageHeader, PageShell } from '@/components/ui/page';
import { ScannerCandidatePanel } from './ScannerCandidatePanel';
import { ScannerSetupPanels } from './ScannerSetupPanels';
import { ScannerStatusNotices } from './ScannerStatusNotices';
import { useScannerPageActions } from './useScannerPageActions';

export function ScannerPage({ onOpenTask }: { onOpenTask?: (taskId: string) => void }) {
  const scanner = useScannerPageActions();

  return (
    <PageShell>
      <PageFrame>
        <PageHeader title="扫描入库" description="添加目录、扫描子文件夹、识别 exe、确认后写入数据库。" />
        <ScannerStatusNotices error={scanner.error} message={scanner.message} onOpenTask={onOpenTask} />

        <div className="grid min-h-[calc(100vh-9rem)] gap-4 xl:grid-cols-[0.86fr_1.14fr]">
          <ScannerSetupPanels
            candidateSummary={scanner.candidateSummary}
            importedIds={scanner.importedIds}
            importReport={scanner.importReport}
            loading={scanner.loading}
            matchStatus={scanner.matchStatus}
            path={scanner.path}
            recursive={scanner.recursive}
            reportActionFilter={scanner.reportActionFilter}
            scanning={scanner.scanning}
            scanStatus={scanner.scanStatus}
            onCancelScan={() => void scanner.cancelScan()}
            onCopyAuditInstallPath={scanner.copyAuditInstallPath}
            onCopyScanPath={scanner.copyScanPath}
            onMatchImported={() => void scanner.matchImported()}
            onPathChange={scanner.setPath}
            onPickDirectory={() => void scanner.pickDirectory()}
            onRecursiveChange={scanner.setRecursive}
            onReportActionFilterChange={scanner.setReportActionFilter}
            onScan={() => void scanner.scan()}
          />

          <ScannerCandidatePanel
            candidates={scanner.candidates}
            conflictActions={scanner.conflictActions}
            loading={scanner.loading}
            scanning={scanner.scanning}
            selectedIds={scanner.selectedIds}
            onCopyExecutablePath={scanner.copyCandidateExecutablePath}
            onCopyInstallPath={scanner.copyCandidateInstallPath}
            onImportSelected={() => void scanner.importSelected()}
            onToggleCandidate={scanner.toggle}
            onUpdateConflictAction={scanner.updateConflictAction}
          />
        </div>
      </PageFrame>
    </PageShell>
  );
}
