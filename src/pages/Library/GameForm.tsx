import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/ui/notice';
import { Select } from '@/components/ui/select';
import { api } from '@/services/api';
import { chooseDirectory, chooseExecutable, chooseImage } from '@/services/dialog';
import type { Game, GameFormInput, PlayStatus } from '@/types/game';
import { PLAY_STATUS_LABEL } from '@/types/game';
import type { MetadataSearchResult } from '@/types/metadata';
import { cn } from '@/utils/cn';
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
import { GameFormAdvancedSection } from './GameFormAdvancedSection';
import { Field, InputWithButton } from './GameFormControls';
import { QuickAddMetadataPanel } from './QuickAddMetadataPanel';

type GameFormProps = {
  game?: Game | null;
  onSubmit: (input: GameFormInput) => Promise<void>;
  onCancel: () => void;
};

const statusOptions: PlayStatus[] = ['planned', 'playing', 'completed', 'paused', 'archived'];

export function GameForm({ game, onSubmit, onCancel }: GameFormProps) {
  const initial = useMemo(() => initialGameFormState(game), [game]);

  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [scrapeMessage, setScrapeMessage] = useState<string | null>(null);
  const [scrapeCandidates, setScrapeCandidates] = useState<MetadataSearchResult[]>([]);
  const [selectedCandidateKey, setSelectedCandidateKey] = useState<string | null>(null);
  const isEditing = Boolean(game);
  const [advancedOpen, setAdvancedOpen] = useState(isEditing);

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

  const copyPath = async (label: string, value: string) => {
    const clean = value.trim();
    if (!clean) return;
    setError(null);
    try {
      await navigator.clipboard.writeText(clean);
      setMessage(`已复制${label}路径。`);
    } catch (reason) {
      setError(errorMessage(reason));
    }
  };

  const copyText = async (label: string, value: string) => {
    const clean = value.trim();
    if (!clean) return;
    setError(null);
    try {
      await navigator.clipboard.writeText(clean);
      setMessage(`已复制${label}。`);
    } catch (reason) {
      setError(errorMessage(reason));
    }
  };

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
      const candidates = response.results.slice(0, 5);
      setScrapeCandidates(candidates);
      if (response.errors.length > 0) {
        setError(friendlyMetadataErrors(response.errors).join(' '));
      }
      const selected = response.results.find((item) => item.fromVndbSniff) ?? response.results.find((item) => item.relevanceScore >= 0.3) ?? response.results[0] ?? null;
      if (!selected) {
        setScrapeMessage(`没有找到可靠元数据，已先填入识别标题「${guessedTitle}」。`);
        return;
      }

      setSelectedCandidateKey(candidateKey(selected));
      const detail = await loadMetadataDetail(selected);
      const nextForm = mergeMetadataIntoForm(baseForm, detail, guessedTitle, mergeMode);
      setForm((current) => ({ ...current, ...nextForm }));
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

  return (
    <div className="space-y-3 text-slate-200">
      {error && <Notice tone="error">{error}</Notice>}
      {message && <Notice>{message}</Notice>}
      {!isEditing && (
        <QuickAddMetadataPanel
          canScrape={canScrape}
          form={form}
          scraping={scraping}
          scrapeCandidates={scrapeCandidates}
          scrapeMessage={scrapeMessage}
          selectedCandidateKey={selectedCandidateKey}
          onRescrape={() => void autoScrapeFromPath(scrapeSource, form, 'replace')}
          onSelectCandidate={(candidate) => void selectCandidate(candidate)}
        />
      )}

      <div className={cn('grid gap-3', isEditing ? 'md:grid-cols-2' : 'grid-cols-1')}>
        <Field label="标题" required><Input value={form.title} onChange={(event) => update('title', event.target.value)} /></Field>
        {isEditing && <Field label="原名"><Input value={form.originalTitle} onChange={(event) => update('originalTitle', event.target.value)} /></Field>}
        {isEditing && (
          <Field label="游玩状态">
            <Select className="w-full" value={form.playStatus} onChange={(event) => update('playStatus', event.target.value)}>
              {statusOptions.map((status) => <option key={status} value={status}>{PLAY_STATUS_LABEL[status]}</option>)}
            </Select>
          </Field>
        )}
        <Field label="安装目录" required><InputWithButton copyLabel="安装目录" value={form.installPath} onChange={(value) => update('installPath', value)} onCopy={() => void copyPath('安装目录', form.installPath)} onPick={() => void pickDirectory('installPath')} /></Field>
        <Field label="启动程序"><InputWithButton copyLabel="启动程序" value={form.executablePath} onChange={(value) => update('executablePath', value)} onCopy={() => void copyPath('启动程序', form.executablePath)} onPick={() => void pickExecutable()} /></Field>
      </div>

      <GameFormAdvancedSection
        advancedOpen={advancedOpen}
        form={form}
        isEditing={isEditing}
        statusOptions={statusOptions}
        onCopyPath={(label, value) => void copyPath(label, value)}
        onCopyText={(label, value) => void copyText(label, value)}
        onPickDirectory={(key) => void pickDirectory(key)}
        onPickImage={(key) => void pickImage(key)}
        onToggle={() => setAdvancedOpen((value) => !value)}
        onUpdate={update}
        onUpdateBool={updateBool}
      />

      <div className="sticky bottom-0 z-10 -mx-5 -mb-5 flex justify-end gap-2 border-t border-white/10 bg-[rgb(var(--modal-rgb)/0.98)] px-5 py-3 backdrop-blur-xl">
        <Button type="button" variant="ghost" onClick={onCancel}>取消</Button>
        <Button type="button" disabled={saving} onClick={submit}>{saving ? '保存中...' : '保存'}</Button>
      </div>
    </div>
  );
}

async function loadMetadataDetail(candidate: MetadataSearchResult) {
  return api.getMetadataDetail(candidate.provider, candidate.id).catch(() => resultToMetadata(candidate));
}
