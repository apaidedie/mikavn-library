import { useCallback, useState } from 'react';
import { api } from '@/services/api';
import { errorMessage } from '@/utils/errorMessage';
import { formatCount } from './MaintenancePageParts';

type TaskMessage = { text: string; taskId?: string | null };

type UseMaintenanceQueueActionsOptions = {
  loadDiagnostics: () => Promise<void>;
  loadMaintenanceTasks: (options?: { quiet?: boolean }) => Promise<void>;
  onOpenTasks?: (taskId?: string | null) => void;
  refreshHistoryForTaskType: (taskType: string, options?: { onlyIfLoaded?: boolean }) => Promise<boolean>;
  setError: (message: string | null) => void;
  setMessage: (message: TaskMessage | null) => void;
};

export function useMaintenanceQueueActions({ loadDiagnostics, loadMaintenanceTasks, onOpenTasks, refreshHistoryForTaskType, setError, setMessage }: UseMaintenanceQueueActionsOptions) {
  const [metadataRepairLoading, setMetadataRepairLoading] = useState(false);
  const [descriptionRepairLoading, setDescriptionRepairLoading] = useState(false);
  const [artworkRepairLoading, setArtworkRepairLoading] = useState(false);
  const [duplicateAuditLoading, setDuplicateAuditLoading] = useState(false);

  const startMetadataRepair = useCallback(async () => {
    setMetadataRepairLoading(true);
    setError(null);
    setMessage(null);
    try {
      const job = await api.batchMatchMissingMetadata();
      if (!job) {
        setMessage({ text: '没有需要批量匹配元数据的条目。' });
        await loadDiagnostics();
        return;
      }
      const text = `已创建批量元数据匹配任务：${formatCount(job.total)} 个条目。`;
      setMessage({ text, taskId: job.taskId ?? null });
      await loadMaintenanceTasks({ quiet: true });
      if (!await refreshHistoryForTaskType('metadata.batch_match', { onlyIfLoaded: true }) && job.taskId) onOpenTasks?.(job.taskId);
      await loadDiagnostics();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setMetadataRepairLoading(false);
    }
  }, [loadDiagnostics, loadMaintenanceTasks, onOpenTasks, refreshHistoryForTaskType, setError, setMessage]);

  const startDescriptionImageRepair = useCallback(async () => {
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
      await loadMaintenanceTasks({ quiet: true });
      if (!await refreshHistoryForTaskType('metadata.description_image_repair', { onlyIfLoaded: true })) onOpenTasks?.(task.id);
      await loadDiagnostics();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setDescriptionRepairLoading(false);
    }
  }, [loadDiagnostics, loadMaintenanceTasks, onOpenTasks, refreshHistoryForTaskType, setError, setMessage]);

  const startArtworkRepair = useCallback(async () => {
    setArtworkRepairLoading(true);
    setError(null);
    setMessage(null);
    try {
      const options = { providers: ['all'], fields: ['cover', 'banner', 'background'], limit: 20 };
      const preview = await api.previewArtworkRepair(options);
      if (preview.totalCandidates === 0) {
        setMessage({ text: '没有可补全媒体图片的条目。' });
        await loadDiagnostics();
        return;
      }
      const task = await api.repairArtwork(options);
      setMessage({ text: `已创建媒体图片补全任务：本轮 ${formatCount(preview.candidates.length)} 个条目，${formatCount(preview.totalMissingFields)} 个字段。`, taskId: task.id });
      await loadMaintenanceTasks({ quiet: true });
      if (!await refreshHistoryForTaskType('metadata.artwork_repair', { onlyIfLoaded: true })) onOpenTasks?.(task.id);
      await loadDiagnostics();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setArtworkRepairLoading(false);
    }
  }, [loadDiagnostics, loadMaintenanceTasks, onOpenTasks, refreshHistoryForTaskType, setError, setMessage]);

  const startDuplicateExternalIdAudit = useCallback(async () => {
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
      await loadMaintenanceTasks({ quiet: true });
      if (!await refreshHistoryForTaskType('metadata.duplicate_id_audit', { onlyIfLoaded: true })) onOpenTasks?.(task.id);
      await loadDiagnostics();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setDuplicateAuditLoading(false);
    }
  }, [loadDiagnostics, loadMaintenanceTasks, onOpenTasks, refreshHistoryForTaskType, setError, setMessage]);

  return {
    artworkRepairLoading,
    descriptionRepairLoading,
    duplicateAuditLoading,
    metadataRepairLoading,
    startArtworkRepair,
    startDescriptionImageRepair,
    startDuplicateExternalIdAudit,
    startMetadataRepair,
  };
}
