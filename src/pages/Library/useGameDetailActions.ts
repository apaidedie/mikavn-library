import { useEffect, useMemo, useState } from 'react';
import { api } from '@/services/api';
import { chooseDirectory } from '@/services/dialog';
import type { ImageReferenceAudit } from '@/types/archive';
import type { Game, GamePathHealth, PlaySession } from '@/types/game';
import type { LaunchProfile } from '@/types/launch';
import { errorMessage } from '@/utils/errorMessage';
import { pathHealthMessage } from './GamePathPanel';

export type TaskMessage = { text: string; taskId?: string | null };

type UseGameDetailActionsOptions = {
  game: Game | null;
  onDeleted: () => void;
  onChanged?: (game: Game) => void;
};

export function useGameDetailActions({ game, onChanged, onDeleted }: UseGameDetailActionsOptions) {
  const [message, setMessage] = useState<TaskMessage | null>(null);
  const [profiles, setProfiles] = useState<LaunchProfile[]>([]);
  const [sessions, setSessions] = useState<PlaySession[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [pathHealth, setPathHealth] = useState<GamePathHealth | null>(null);
  const [imageAudit, setImageAudit] = useState<ImageReferenceAudit | null>(null);
  const [imageAuditLoading, setImageAuditLoading] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const selectedProfile = useMemo(() => profiles.find((profile) => profile.id === selectedProfileId) ?? profiles.find((profile) => profile.isDefault) ?? profiles[0], [profiles, selectedProfileId]);

  useEffect(() => {
    let cancelled = false;
    setMessage(null);
    setProfiles([]);
    setSessions([]);
    setSelectedProfileId('');
    setPathHealth(null);
    setImageAudit(null);
    setImageAuditLoading(false);
    if (!game) return;
    setNotesDraft(game.notes ?? '');
    api.listLaunchProfiles(game.id)
      .then((items) => {
        if (cancelled) return;
        setProfiles(items);
        setSelectedProfileId(items.find((item) => item.isDefault)?.id ?? items[0]?.id ?? '');
      })
      .catch((reason) => {
        if (cancelled) return;
        setMessage({ text: errorMessage(reason) });
      });
    api.listPlaySessions(game.id)
      .then((items) => {
        if (cancelled) return;
        setSessions(items);
      })
      .catch(() => {
        if (cancelled) return;
        setSessions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [game?.id]);

  const launch = async () => {
    if (!game) return;
    setMessage(null);
    try {
      await api.launchGameWithProfile(game.id, selectedProfile?.id);
      setMessage({ text: '已发送启动请求。游戏退出后会自动累计时长。' });
      api.listPlaySessions(game.id).then(setSessions).catch(() => undefined);
    } catch (reason) {
      setMessage({ text: errorMessage(reason) });
    }
  };

  const remove = async () => {
    if (!game || !window.confirm(`删除游戏记录「${game.title}」？\n\n只会删除 MikaVN 数据库记录，不会删除真实游戏文件。\n会移除应用内的启动记录、存档路径、图库引用和合集关系。确认继续？`)) return;
    await api.deleteGameRecord(game.id);
    onDeleted();
  };

  const checkPaths = async () => {
    if (!game) return;
    setMessage(null);
    try {
      const health = await api.checkGamePaths(game.id);
      setPathHealth(health);
      onChanged?.(await api.getGame(game.id));
      setMessage({ text: pathHealthMessage(health.status) });
    } catch (reason) {
      setMessage({ text: errorMessage(reason) });
    }
  };

  const checkPathsInBackground = async () => {
    if (!game) return;
    setMessage(null);
    try {
      const task = await api.checkGamePathsTask(game.id);
      setMessage({ text: `已创建路径检查任务：${task.message || '可在任务页查看进度。'}`, taskId: task.id });
    } catch (reason) {
      setMessage({ text: errorMessage(reason) });
    }
  };

  const relocate = async () => {
    if (!game) return;
    const selected = await chooseDirectory(game.installPath);
    if (!selected) return;
    try {
      const updated = await api.relocateGamePaths(game.id, selected);
      onChanged?.(updated);
      setPathHealth(null);
      setMessage({ text: '安装目录已重定位，启动配置中的同前缀路径也已同步更新。' });
      api.listLaunchProfiles(game.id).then(setProfiles).catch(() => undefined);
    } catch (reason) {
      setMessage({ text: errorMessage(reason) });
    }
  };

  const saveNotes = async () => {
    if (!game) return;
    setSavingNotes(true);
    setMessage(null);
    try {
      const updated = await api.updateGame(game.id, { notes: notesDraft });
      onChanged?.(updated);
      setMessage({ text: '个人备注已保存。' });
    } catch (reason) {
      setMessage({ text: errorMessage(reason) });
    } finally {
      setSavingNotes(false);
    }
  };

  const reveal = async (path?: string | null) => {
    if (!path) return;
    setMessage(null);
    try {
      await api.revealPath(path);
    } catch (reason) {
      setMessage({ text: errorMessage(reason) });
    }
  };

  const copyPath = async (label: string, path?: string | null) => copyTextValue(`${label}路径`, path);
  const copyText = async (label: string, value?: string | null) => copyTextValue(label, value);

  async function copyTextValue(label: string, value?: string | null) {
    if (!value) return;
    setMessage(null);
    try {
      await navigator.clipboard.writeText(value);
      setMessage({ text: `已复制${label}。` });
    } catch (reason) {
      setMessage({ text: errorMessage(reason) });
    }
  }

  const checkImageReferences = async () => {
    if (!game) return;
    setImageAuditLoading(true);
    setMessage(null);
    try {
      const audit = await api.auditImageReferences({ gameId: game.id, includeOk: true, limit: 80 });
      setImageAudit(audit);
      setMessage({ text: audit.issueCount > 0 ? `图片引用检查完成：发现 ${audit.issueCount} 条问题引用。` : '图片引用检查完成，没有发现问题引用。' });
    } catch (reason) {
      setMessage({ text: errorMessage(reason) });
    } finally {
      setImageAuditLoading(false);
    }
  };

  return {
    imageAudit,
    imageAuditLoading,
    message,
    notesDraft,
    pathHealth,
    profiles,
    savingNotes,
    selectedProfile,
    selectedProfileId,
    sessions,
    actions: {
      checkImageReferences,
      checkPaths,
      checkPathsInBackground,
      copyPath,
      copyText,
      launch,
      relocate,
      remove,
      reveal,
      saveNotes,
      setMessage,
      setNotesDraft,
      setProfiles,
      setSelectedProfileId,
    },
  };
}
