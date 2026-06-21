import { useCallback, useState } from 'react';
import { api } from '@/services/api';
import type { ImageHealthReport, ImageReferenceAudit } from '@/types/archive';
import type { ArtworkRepairDiagnosis } from '@/types/metadata';
import { errorMessage } from '@/utils/errorMessage';
import { formatCount } from './MaintenancePageParts';
import { formatImageDuplicateContentQuarantineCompletionMessage, formatImageInvalidQuarantineCompletionMessage, formatImageQuarantineCompletionMessage } from './maintenanceImageHealthModel';

type TaskMessage = { text: string; taskId?: string | null };

type UseMaintenanceInspectionActionsOptions = {
  setError: (message: string | null) => void;
  setMessage: (message: TaskMessage | null) => void;
};

export function useMaintenanceInspectionActions({ setError, setMessage }: UseMaintenanceInspectionActionsOptions) {
  const [imageAudit, setImageAudit] = useState<ImageReferenceAudit | null>(null);
  const [imageAuditLoading, setImageAuditLoading] = useState(false);
  const [imageAuditQuery, setImageAuditQuery] = useState('');
  const [imageAuditIssueFilter, setImageAuditIssueFilter] = useState('all');
  const [imageHealth, setImageHealth] = useState<ImageHealthReport | null>(null);
  const [imageHealthLoading, setImageHealthLoading] = useState(false);
  const [artworkDiagnosis, setArtworkDiagnosis] = useState<ArtworkRepairDiagnosis | null>(null);
  const [artworkDiagnosisLoading, setArtworkDiagnosisLoading] = useState(false);
  const [artworkDiagnosisQuery, setArtworkDiagnosisQuery] = useState('');
  const [artworkDiagnosisStatusFilter, setArtworkDiagnosisStatusFilter] = useState('all');

  const loadImageAudit = useCallback(async () => {
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
  }, [setError, setMessage]);

  const loadArtworkDiagnosis = useCallback(async () => {
    setArtworkDiagnosisLoading(true);
    setError(null);
    try {
      const diagnosis = await api.diagnoseArtworkRepair({ providers: ['all'], fields: ['cover', 'banner', 'background'], limit: 50 });
      setArtworkDiagnosis(diagnosis);
      setMessage({ text: diagnosis.totalMissingGames > 0 ? `媒体补全诊断完成：${formatCount(diagnosis.repairableCount)} 个可补全，${formatCount(diagnosis.missingExternalIdCount)} 个缺外部 ID。` : '媒体补全诊断完成，没有发现缺图条目。' });
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setArtworkDiagnosisLoading(false);
    }
  }, [setError, setMessage]);

  const loadImageHealth = useCallback(async () => {
    setImageHealthLoading(true);
    setError(null);
    try {
      const report = await api.getImageHealthReport({ sampleLimit: 100 });
      setImageHealth(report);
      setMessage({ text: `图片健康检查完成：${formatCount(report.summary.imageFiles)} 个缓存文件，${formatCount(report.summary.orphanFiles)} 个孤儿图片。` });
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setImageHealthLoading(false);
    }
  }, [setError, setMessage]);

  const quarantineOrphanImages = useCallback(async () => {
    const orphanCount = imageHealth?.summary.orphanFiles ?? 0;
    const confirmed = window.confirm(
      `将把 ${formatCount(orphanCount)} 个未被数据库引用的孤儿图片移动到隔离区。\n\n不会永久删除文件；隔离区会写入 manifest.json，必要时可以按清单找回原路径。确认继续？`,
    );
    if (!confirmed) return;

    setImageHealthLoading(true);
    setError(null);
    try {
      const result = await api.quarantineOrphanImages({ sampleLimit: 100 });
      const report = await api.getImageHealthReport({ sampleLimit: 100 });
      setImageHealth(report);
      setMessage({ text: formatImageQuarantineCompletionMessage(result, report) });
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setImageHealthLoading(false);
    }
  }, [imageHealth?.summary.orphanFiles, setError, setMessage]);

  const quarantineDuplicateContentImages = useCallback(async () => {
    const duplicateGroupCount = imageHealth?.summary.duplicateContentGroups ?? 0;
    const confirmed = window.confirm(
      `将整理 ${formatCount(duplicateGroupCount)} 组重复内容缓存。\n\n只会移动未被数据库引用的重复副本；会保留被数据库引用的图片。如果整组都未被引用，也会至少保留一个未引用副本。隔离区会写入 manifest.json，必要时可以按清单找回原路径。确认继续？`,
    );
    if (!confirmed) return;

    setImageHealthLoading(true);
    setError(null);
    try {
      const result = await api.quarantineDuplicateContentImages({ sampleLimit: 100 });
      const report = await api.getImageHealthReport({ sampleLimit: 100 });
      setImageHealth(report);
      setMessage({ text: formatImageDuplicateContentQuarantineCompletionMessage(result, report) });
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setImageHealthLoading(false);
    }
  }, [imageHealth?.summary.duplicateContentGroups, setError, setMessage]);

  const quarantineInvalidImageCacheFiles = useCallback(async () => {
    const invalidUnreferencedCount = Math.max(0, (imageHealth?.summary.invalidImageFiles ?? 0) - (imageHealth?.summary.invalidImageRefs ?? 0));
    const confirmed = window.confirm(
      `将把 ${formatCount(invalidUnreferencedCount)} 个未被数据库引用的无效图片移动到隔离区。\n\n仍被引用的无效图片会保留给补图或明细审计，不会直接移动。隔离区会写入 manifest.json，必要时可以按清单找回原路径。确认继续？`,
    );
    if (!confirmed) return;

    setImageHealthLoading(true);
    setError(null);
    try {
      const result = await api.quarantineInvalidImageCacheFiles({ sampleLimit: 100 });
      const report = await api.getImageHealthReport({ sampleLimit: 100 });
      setImageHealth(report);
      setMessage({ text: formatImageInvalidQuarantineCompletionMessage(result, report) });
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setImageHealthLoading(false);
    }
  }, [imageHealth?.summary.invalidImageFiles, imageHealth?.summary.invalidImageRefs, setError, setMessage]);

  const resetImageAuditFilters = useCallback(() => {
    setImageAuditQuery('');
    setImageAuditIssueFilter('all');
  }, []);

  const resetArtworkDiagnosisFilters = useCallback(() => {
    setArtworkDiagnosisQuery('');
    setArtworkDiagnosisStatusFilter('all');
  }, []);

  return {
    artworkDiagnosis,
    artworkDiagnosisLoading,
    artworkDiagnosisQuery,
    artworkDiagnosisStatusFilter,
    imageAudit,
    imageAuditIssueFilter,
    imageAuditLoading,
    imageAuditQuery,
    imageHealth,
    imageHealthLoading,
    loadArtworkDiagnosis,
    loadImageAudit,
    loadImageHealth,
    quarantineDuplicateContentImages,
    quarantineInvalidImageCacheFiles,
    quarantineOrphanImages,
    resetArtworkDiagnosisFilters,
    resetImageAuditFilters,
    setArtworkDiagnosisQuery,
    setArtworkDiagnosisStatusFilter,
    setImageAuditIssueFilter,
    setImageAuditQuery,
  };
}
