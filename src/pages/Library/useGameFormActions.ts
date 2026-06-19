import { useEffect, useMemo, useState } from 'react';
import { api } from '@/services/api';
import { chooseDirectory, chooseExecutable, chooseImage } from '@/services/dialog';
import type { Game, GameFormInput } from '@/types/game';
import type { MetadataSearchResult } from '@/types/metadata';
import { errorMessage } from '@/utils/errorMessage';
import { friendlyMetadataErrors, metadataErrorMessage } from '@/utils/metadataErrors';
import {
  candidateKey,
  guessTitleFromPath,
  guessTitleSourceFromExecutable,
  initialGameFormState,
  mergeListText,
  mergeMetadataIntoForm,
  parentPath,
  providerLabel,
  resultToMetadata,
  toGameFormInput,
  type GameFormState,
  type MetadataMergeMode,
} from './gameFormMapping';

export function useGameFormActions(game: Game | null | undefined, onSubmit: (input: GameFormInput) => Promise<void>) {
  const initial = useMemo(() => initialGameFormState(game), [game]);
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [scrapeMessage, setScrapeMessage] = useState<string | null>(null);
  const [scrapeCandidates, setScrapeCandidates] = useState<MetadataSearchResult[]>([]);
  const [selectedCandidateKey, setSelectedCandidateKey] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(Boolean(game));
  const isEditing = Boolean(game);

  useEffect(() => {
    setForm(initial);
    setError(null);
    setMessage(null);
    setScrapeMessage(null);
    setScrapeCandidates([]);
    setSelectedCandidateKey(null);
    setAdvancedOpen(Boolean(game));
  }, [game, initial]);

  const update = (key: keyof GameFormState, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const updateBool = (key: 'favorite' | 'hidden', value: boolean) => setForm((current) => ({ ...current, [key]: value }));

  const copyPath = async (label: string, value: string) => copyTextValue(`${label}路径`, value);
  const copyText = async (label: string, value: string) => copyTextValue(label, value);

  const pickDirectory = async (key: 'installPath' | 'workingDirectory') => {
    const selected = await chooseDirectory(form[key]);
    if (!selected) return;
    const next = {
      ...form,
      [key]: selected,
      workingDirectory: key === 'installPath' && !form.workingDirectory.trim() ? selected : form.workingDirectory,
    };
    setForm(next);
    if (key === 'installPath' && !game) {
      void autoScrapeFromPath(selected, next, 'replace');
    }
  };

  const pickExecutable = async () => {
    const selected = await chooseExecutable(form.executablePath);
    if (!selected) return;
    const guessedInstallPath = form.installPath || parentPath(selected);
    const next = {
      ...form,
      executablePath: selected,
      installPath: guessedInstallPath,
      workingDirectory: form.workingDirectory || guessedInstallPath,
    };
    setForm(next);
    if (!game) {
      void autoScrapeFromPath(guessTitleSourceFromExecutable(selected, guessedInstallPath), next, 'replace');
    }
  };

  const pickImage = async (key: 'coverImage' | 'bannerImage' | 'backgroundImage') => {
    const selected = await chooseImage(form[key]);
    if (selected) setForm((current) => ({ ...current, [key]: selected }));
  };

  const submit = async () => {
    if (!form.title.trim() || !form.installPath.trim()) {
      setError('标题和安装目录必填。');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSubmit(toGameFormInput(form, game));
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  };

  async function copyTextValue(label: string, value: string) {
    const clean = value.trim();
    if (!clean) return;
    setError(null);
    try {
      await navigator.clipboard.writeText(clean);
      setMessage(`已复制${label}。`);
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  async function autoScrapeFromPath(path: string, baseForm = form, mergeMode: MetadataMergeMode = 'fill-empty') {
    const guessedTitle = guessTitleFromPath(path);
    if (!guessedTitle) return;

    setScraping(true);
    setError(null);
    setScrapeMessage(`正在用「${guessedTitle}」搜索 VNDB / DLsite / FANZA...`);
    setScrapeCandidates([]);
    setSelectedCandidateKey(null);
    setForm((current) => ({
      ...current,
      title: mergeMode === 'replace' || !current.title.trim() ? guessedTitle : current.title,
      aliases: mergeListText(current.aliases, guessedTitle),
    }));

    try {
      const response = await api.searchMetadata(guessedTitle, ['vndb', 'dlsite', 'fanza']);
      const selected = response.results.find((item) => item.fromVndbSniff) ?? response.results.find((item) => item.relevanceScore >= 0.3) ?? response.results[0] ?? null;
      setScrapeCandidates(response.results.slice(0, 5));
      if (response.errors.length > 0) {
        setError(friendlyMetadataErrors(response.errors).join(' '));
      }
      if (!selected) {
        setScrapeMessage(`没有找到可靠元数据，已先填入识别标题「${guessedTitle}」。`);
        return;
      }

      setSelectedCandidateKey(candidateKey(selected));
      const detail = await loadMetadataDetail(selected);
      setForm((current) => ({ ...current, ...mergeMetadataIntoForm(baseForm, detail, guessedTitle, mergeMode) }));
      setScrapeMessage(`已预填推荐候选：${providerLabel(selected.provider)} ${selected.id}。可切换候选后再保存。`);
    } catch (reason) {
      setScrapeMessage(`自动识别失败，已先填入标题「${guessedTitle}」。`);
      setError(metadataErrorMessage(reason));
    } finally {
      setScraping(false);
    }
  }

  async function selectCandidate(candidate: MetadataSearchResult) {
    if (scraping) return;
    const guessedTitle = guessTitleFromPath(scrapeSource || form.title) || form.title;
    setScraping(true);
    setError(null);
    setSelectedCandidateKey(candidateKey(candidate));
    setScrapeMessage(`正在载入 ${providerLabel(candidate.provider)} ${candidate.id}...`);
    try {
      const detail = await loadMetadataDetail(candidate);
      setForm((current) => ({ ...current, ...mergeMetadataIntoForm(current, detail, guessedTitle, 'replace') }));
      setScrapeMessage(`已切换到 ${providerLabel(candidate.provider)} ${candidate.id}：${detail.title}`);
    } catch (reason) {
      setError(metadataErrorMessage(reason));
      setScrapeMessage(`候选详情载入失败，仍保留当前预填信息。`);
    } finally {
      setScraping(false);
    }
  }

  const scrapeSource = form.executablePath ? guessTitleSourceFromExecutable(form.executablePath, form.installPath) : form.installPath || form.title;
  const canScrape = !scraping && Boolean(guessTitleFromPath(scrapeSource));

  return {
    advancedOpen,
    canScrape,
    error,
    form,
    isEditing,
    message,
    saving,
    scraping,
    scrapeCandidates,
    scrapeMessage,
    scrapeSource,
    selectedCandidateKey,
    actions: {
      copyPath,
      copyText,
      pickDirectory,
      pickExecutable,
      pickImage,
      selectCandidate,
      setAdvancedOpen,
      submit,
      update,
      updateBool,
      rescrape: () => autoScrapeFromPath(scrapeSource, form, 'replace'),
    },
  };
}

async function loadMetadataDetail(candidate: MetadataSearchResult) {
  return api.getMetadataDetail(candidate.provider, candidate.id).catch(() => resultToMetadata(candidate));
}
