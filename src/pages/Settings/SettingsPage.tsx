import { Bot, Database, Download, FileText, Folder, FolderSearch, Loader2, Palette, RotateCcw, Save, Search, Tags, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckboxField } from '@/components/ui/checkbox';
import { ConfigItem, ConfigSection } from '@/components/ui/config-item';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/ui/notice';
import { PageFrame, PageHeader, PageShell } from '@/components/ui/page';
import { Select } from '@/components/ui/select';
import { TaskNotice } from '@/components/ui/task-notice';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/services/api';
import { chooseArchiveDirectory, chooseArchivePath, chooseDatabaseBackupPath, chooseDatabaseRestorePath, chooseDirectory } from '@/services/dialog';
import type { LibraryArchivePreview, LogRecord } from '@/types/archive';
import type { LibraryRoot, TagRecord } from '@/types/game';
import type { MetadataSourceRecord } from '@/types/metadata';
import { cn } from '@/utils/cn';
import { errorMessage } from '@/utils/errorMessage';

type SettingsForm = {
  provider_vndb_enabled: boolean;
  provider_dlsite_enabled: boolean;
  provider_fanza_enabled: boolean;
  ai_base_url: string;
  ai_model: string;
  ai_api_key: string;
  ui_accent_color: string;
  ui_theme_mode: string;
  privacy_hide_hidden: boolean;
  privacy_blur_covers: boolean;
  privacy_filter_reports: boolean;
  save_auto_backup_before_launch: boolean;
  save_auto_backup_after_exit: boolean;
};

type TaskMessage = { text: string; taskId?: string | null };

const defaults: SettingsForm = {
  provider_vndb_enabled: true,
  provider_dlsite_enabled: true,
  provider_fanza_enabled: true,
  ai_base_url: '',
  ai_model: 'gpt-4o-mini',
  ai_api_key: '',
  ui_accent_color: 'vnite',
  ui_theme_mode: 'dark',
  privacy_hide_hidden: false,
  privacy_blur_covers: false,
  privacy_filter_reports: true,
  save_auto_backup_before_launch: false,
  save_auto_backup_after_exit: false,
};

export function SettingsPage({ onAccentPreview, onThemePreview, onSaved, onOpenTask }: { onAccentPreview?: (uiAccentColor: string) => void; onThemePreview?: (uiThemeMode: string) => void; onSaved?: () => void; onOpenTask?: (taskId: string) => void }) {
  const [form, setForm] = useState<SettingsForm>(defaults);
  const [message, setMessage] = useState<TaskMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [archiveDir, setArchiveDir] = useState('');
  const [archivePreview, setArchivePreview] = useState<LibraryArchivePreview | null>(null);
  const [includeImages, setIncludeImages] = useState(true);
  const [includeSaveBackups, setIncludeSaveBackups] = useState(false);
  const [metadataSources, setMetadataSources] = useState<MetadataSourceRecord[]>([]);
  const [libraryRoots, setLibraryRoots] = useState<LibraryRoot[]>([]);
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [tags, setTags] = useState<TagRecord[]>([]);
  const [selectedTagId, setSelectedTagId] = useState('');
  const [renameTagName, setRenameTagName] = useState('');
  const [mergeSourceIds, setMergeSourceIds] = useState<string[]>([]);
  const [libraryRootPath, setLibraryRootPath] = useState('');
  const [rootActionId, setRootActionId] = useState<string | null>(null);
  const [testingAi, setTestingAi] = useState(false);

  useEffect(() => {
    api.getAppSettings().then((settings) => {
      setForm({
        provider_vndb_enabled: settings.provider_vndb_enabled !== 'false',
        provider_dlsite_enabled: settings.provider_dlsite_enabled !== 'false',
        provider_fanza_enabled: settings.provider_fanza_enabled !== 'false',
        ai_base_url: settings.ai_base_url ?? '',
        ai_model: settings.ai_model ?? 'gpt-4o-mini',
        ai_api_key: settings.ai_api_key ?? '',
        ui_accent_color: settings.ui_accent_color ?? 'vnite',
        ui_theme_mode: settings.ui_theme_mode ?? 'dark',
        privacy_hide_hidden: settings.privacy_hide_hidden === 'true',
        privacy_blur_covers: settings.privacy_blur_covers === 'true',
        privacy_filter_reports: settings.privacy_filter_reports !== 'false',
        save_auto_backup_before_launch: settings.save_auto_backup_before_launch === 'true',
        save_auto_backup_after_exit: settings.save_auto_backup_after_exit === 'true',
      });
      onAccentPreview?.(settings.ui_accent_color ?? 'vnite');
      onThemePreview?.(settings.ui_theme_mode ?? 'dark');
    }).catch((reason: unknown) => setError(errorMessage(reason)));
  }, [onAccentPreview, onThemePreview]);

  useEffect(() => {
    api.listMetadataSources().then(setMetadataSources).catch(() => undefined);
    void loadLibraryRoots();
    void loadLogs();
    void loadTags();
  }, []);

  const save = async () => {
    setError(null);
    setMessage(null);
    try {
      await api.setAppSettings({
        provider_vndb_enabled: String(form.provider_vndb_enabled),
        provider_dlsite_enabled: String(form.provider_dlsite_enabled),
        provider_fanza_enabled: String(form.provider_fanza_enabled),
        ai_base_url: form.ai_base_url,
        ai_model: form.ai_model,
        ai_api_key: form.ai_api_key,
        ui_accent_color: form.ui_accent_color,
        ui_theme_mode: form.ui_theme_mode,
        ui_vnite_theme_migrated: 'true',
        privacy_hide_hidden: String(form.privacy_hide_hidden),
        privacy_blur_covers: String(form.privacy_blur_covers),
        privacy_filter_reports: String(form.privacy_filter_reports),
        save_auto_backup_before_launch: String(form.save_auto_backup_before_launch),
        save_auto_backup_after_exit: String(form.save_auto_backup_after_exit),
      });
      setMessage({ text: form.ai_api_key.trim() ? '设置已保存到本机。API Key 属于本机私有配置，请勿共享数据库或配置文件。' : '设置已保存到本机。' });
      onSaved?.();
    } catch (reason) {
      setError(errorMessage(reason));
    }
  };

  return (
    <PageShell>
      <PageFrame className="max-w-[76rem] gap-6">
        <PageHeader
          title="设置"
          description="本机数据源、外观、AI 与隐私配置。"
          actions={<Button onClick={save}><Save className="h-4 w-4" />保存设置</Button>}
        />
        {(error || message) && (
          <div className="space-y-2">
            {error && <Notice className="py-2" tone="error">{error}</Notice>}
            {message && <TaskNotice message={message.text} taskId={message.taskId} onOpenTask={onOpenTask} />}
          </div>
        )}

        <Tabs defaultValue="appearance">
          <TabsList className="border-b border-white/10">
            <TabsTrigger value="appearance"><Palette className="mr-2 h-4 w-4" />外观</TabsTrigger>
            <TabsTrigger value="sources"><Search className="mr-2 h-4 w-4" />数据源与 AI</TabsTrigger>
            <TabsTrigger value="local"><Database className="mr-2 h-4 w-4" />本地与隐私</TabsTrigger>
          </TabsList>

          <TabsContent className="space-y-6" value="appearance">
            <ConfigSection title="主题">
              <ConfigItem title="外观模式" description="浅色模式适合白天使用；跟随系统会读取系统偏好。">
                <div className="grid grid-cols-3 gap-2">
                  {themeModeOptions.map((option) => (
                    <button
                      className={cn('h-9 rounded-md border px-3 text-xs transition-colors', form.ui_theme_mode === option.id ? 'border-[rgb(var(--accent-rgb)/0.75)] bg-[rgb(var(--accent-rgb)/0.12)] text-slate-100' : 'border-white/10 bg-black/10 text-slate-400 hover:border-white/20')}
                      key={option.id}
                      onClick={() => setThemeMode(option.id)}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </ConfigItem>
              <ConfigItem title="强调色" description="点击色块会立即预览，保存后写入本机配置。">
                <div className="grid grid-cols-5 gap-2">
                  {accentOptions.map((option) => (
                    <button
                      className={cn('flex h-10 w-20 items-center gap-2 rounded-md border px-2 text-xs transition-colors', form.ui_accent_color === option.id ? 'border-[rgb(var(--accent-rgb)/0.75)] bg-[rgb(var(--accent-rgb)/0.12)] text-slate-100' : 'border-white/10 bg-black/10 text-slate-400 hover:border-white/20')}
                      key={option.id}
                      onClick={() => setAccentColor(option.id)}
                      type="button"
                    >
                      <span className="h-4 w-4 rounded-full" style={{ background: option.color }} />
                      {option.label}
                    </button>
                  ))}
                </div>
              </ConfigItem>
            </ConfigSection>
          </TabsContent>

          <TabsContent className="space-y-6" value="sources">
            <ConfigSection title="元数据数据源">
              {metadataSources.length > 0 && (
                <ConfigItem title="来源注册表" description="来自归一化 metadata_sources 表，供后续来源优先级与扩展使用。">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {metadataSources.map((source) => <span className="rounded-full border border-white/10 bg-black/[0.12] px-2 py-1 text-xs text-slate-300" key={source.id}>{source.label} · {source.priority}</span>)}
                  </div>
                </ConfigItem>
              )}
              <ConfigItem title="启用 VNDB" description="用于视觉小说基础元数据、标签和开发商信息。">
                <SettingFlag checked={form.provider_vndb_enabled} label="VNDB" onChange={(value) => setForm((current) => ({ ...current, provider_vndb_enabled: value }))} />
              </ConfigItem>
              <ConfigItem title="启用 DLsite" description="仅检索公开页面和公开搜索结果。">
                <SettingFlag checked={form.provider_dlsite_enabled} label="DLsite" onChange={(value) => setForm((current) => ({ ...current, provider_dlsite_enabled: value }))} />
              </ConfigItem>
              <ConfigItem title="启用 FANZA" description="失败时只记录 provider 级错误，不中断整体搜索。">
                <SettingFlag checked={form.provider_fanza_enabled} label="FANZA" onChange={(value) => setForm((current) => ({ ...current, provider_fanza_enabled: value }))} />
              </ConfigItem>
            </ConfigSection>

            <ConfigSection title="AI 图片识别">
              <ConfigItem title="API Key" description="优先推荐使用环境变量 MIKAVN_AI_API_KEY。">
                <EditableField type="password" value={form.ai_api_key} onChange={(value) => setForm((current) => ({ ...current, ai_api_key: value }))} placeholder="本机私有配置" />
              </ConfigItem>
              <ConfigItem title="Base URL">
                <EditableField value={form.ai_base_url} onChange={(value) => setForm((current) => ({ ...current, ai_base_url: value }))} placeholder="https://api.example.com/v1" />
              </ConfigItem>
              <ConfigItem title="Model">
                <EditableField value={form.ai_model} onChange={(value) => setForm((current) => ({ ...current, ai_model: value }))} placeholder="gpt-4o-mini" />
              </ConfigItem>
              <ConfigItem title="测试连接" description="会先保存当前 AI 配置，再发送一次最小文本请求；不会上传图片，也不会显示 API Key。">
                <Button disabled={testingAi} variant="secondary" onClick={testAiConnection}>
                  {testingAi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                  {testingAi ? '测试中...' : '测试 AI'}
                </Button>
              </ConfigItem>
            </ConfigSection>
          </TabsContent>

          <TabsContent className="space-y-6" value="local">
            <ConfigSection title="库目录">
              <ConfigItem title="添加本地库目录" description="登记常用游戏根目录。扫描仍会先进入候选复核，不会直接写库。">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Input className="w-72" value={libraryRootPath} onChange={(event) => setLibraryRootPath(event.target.value)} placeholder="D:\\Games\\VisualNovel" />
                  <Button variant="outline" onClick={pickLibraryRoot}><Folder className="h-4 w-4" />选择</Button>
                  <Button variant="secondary" onClick={addLibraryRoot}>添加</Button>
                </div>
              </ConfigItem>
              <ConfigItem title="已登记目录" description="可启用/停用、切换递归扫描，或创建扫描任务。">
                <div className="w-full max-w-[42rem] space-y-2">
                  {libraryRoots.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-white/10 bg-black/[0.10] px-3 py-4 text-right text-xs text-slate-500">还没有库目录。</div>
                  ) : libraryRoots.map((root) => (
                    <div className="rounded-lg border border-white/10 bg-black/[0.12] p-3" key={root.id}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 text-left">
                          <div className="break-all font-mono text-xs text-slate-300">{root.path}</div>
                          <div className="mt-1 text-[11px] text-slate-500">{root.enabled ? '已启用' : '已停用'} · {root.recursive ? '递归扫描' : '仅一级目录'}</div>
                        </div>
                        <div className="flex shrink-0 flex-wrap justify-end gap-2">
                          <SettingFlag checked={root.enabled} label="启用" onChange={(value) => void updateLibraryRoot(root, { enabled: value })} />
                          <SettingFlag checked={root.recursive} label="递归" onChange={(value) => void updateLibraryRoot(root, { recursive: value })} />
                          <Button disabled={!root.enabled || rootActionId === root.id} size="sm" variant="secondary" onClick={() => void scanLibraryRoot(root)}><FolderSearch className="h-4 w-4" />扫描</Button>
                          <Button disabled={rootActionId === root.id} size="sm" variant="ghost" onClick={() => void removeLibraryRoot(root)}><Trash2 className="h-4 w-4" />移除</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ConfigItem>
            </ConfigSection>

            <ConfigSection title="本地数据">
              <ConfigItem title="数据库位置" description="应用数据目录 / mikavn.db">
                <Folder className="h-4 w-4 text-slate-500" />
              </ConfigItem>
              <ConfigItem title="手动备份数据库" description="生成 SQLite 一致性备份，备份文件可由你选择保存位置。">
                <Button variant="secondary" onClick={backupDatabase}><Download className="h-4 w-4" />备份</Button>
              </ConfigItem>
              <ConfigItem title="恢复数据库备份" description="复制备份到 pending-restore，下次启动前会先创建保护备份再替换当前数据库。">
                <Button variant="outline" onClick={restoreDatabase}><RotateCcw className="h-4 w-4" />安排恢复</Button>
              </ConfigItem>
              <ConfigItem title="库归档位置" description="导出会在此目录下新建归档文件夹或 ZIP 文件；预览/导入可填写归档文件夹或 .zip 文件。">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Input className="w-72" value={archiveDir} onChange={(event) => setArchiveDir(event.target.value)} placeholder="D:\\MikaVN-Archives" />
                  <Button variant="outline" onClick={pickArchiveDir}>选择</Button>
                  <Button variant="ghost" onClick={pickArchivePath}>选择 ZIP</Button>
                </div>
              </ConfigItem>
              <ConfigItem title="导出库归档" description="包含 manifest、一致性数据库备份、可选图片缓存和存档备份副本。支持目录归档与 ZIP 归档。">
                <div className="flex flex-wrap justify-end gap-2">
                  <SettingFlag checked={includeImages} label="图片缓存" onChange={setIncludeImages} />
                  <SettingFlag checked={includeSaveBackups} label="存档备份" onChange={setIncludeSaveBackups} />
                  <Button variant="secondary" onClick={exportArchive}><Download className="h-4 w-4" />导出归档</Button>
                  <Button variant="outline" onClick={exportArchiveZip}><Download className="h-4 w-4" />导出 ZIP</Button>
                </div>
              </ConfigItem>
              <ConfigItem title="预览库归档" description="只读取目录或 ZIP 中的 manifest 和文件计数，不覆盖当前数据库。">
                <Button variant="outline" onClick={previewArchive}>预览</Button>
              </ConfigItem>
              {archivePreview && (
                <ConfigItem title="归档预览" description={`${archivePreview.manifest.exportedAt} · 数据库 ${archivePreview.databasePresent ? '存在' : '缺失'}`}>
                  <div className="text-right text-xs leading-6 text-slate-400">
                    <div>图片 {archivePreview.imagesCount} 个 · 存档备份 {archivePreview.saveBackupsCount} 个</div>
                    {archivePreview.warnings.map((warning) => <div className="text-amber-200" key={warning}>{warning}</div>)}
                  </div>
                </ConfigItem>
              )}
              <ConfigItem title="安全导入归档" description="支持目录归档与 ZIP 归档。导入前会自动备份当前数据库，只合并不冲突的新游戏记录。">
                <Button disabled={!archivePreview?.databasePresent} variant="secondary" onClick={importArchive}><Download className="h-4 w-4" />安全导入</Button>
              </ConfigItem>
              <ConfigItem title="图片缓存" description="应用数据目录 / images">
                <Folder className="h-4 w-4 text-slate-500" />
              </ConfigItem>
            </ConfigSection>

            <ConfigSection title="诊断日志">
              <ConfigItem title="本地日志" description="只显示已脱敏的本机日志预览，用于排查扫描、备份和启动问题。">
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={loadLogs}><FileText className="h-4 w-4" />刷新</Button>
                  <Button variant="ghost" onClick={pruneLogs}><Trash2 className="h-4 w-4" />清理</Button>
                </div>
              </ConfigItem>
              <ConfigItem title="最近日志" description="默认保留 30 天 / 60 个文件，可通过清理按钮执行保留策略。">
                <div className="w-full max-w-[42rem] space-y-2 text-left">
                  {logs.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-white/10 bg-black/[0.10] px-3 py-4 text-right text-xs text-slate-500">还没有诊断日志。</div>
                  ) : logs.slice(0, 4).map((log) => (
                    <div className="rounded-lg border border-white/10 bg-black/[0.12] p-3" key={log.path}>
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="font-mono text-slate-300">{log.fileName}</span>
                        <span className="text-slate-500">{Math.ceil(log.sizeBytes / 1024)} KB</span>
                      </div>
                      {log.preview.slice(-2).map((line) => <div className="mt-1 break-all font-mono text-[11px] text-slate-500" key={line}>{line}</div>)}
                    </div>
                  ))}
                </div>
              </ConfigItem>
            </ConfigSection>

            <ConfigSection title="标签维护">
              <ConfigItem title="标签总览" description="重命名、合并或删除 normalized tags/game_tags 中的标签，不会删除游戏条目。">
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={loadTags}><Tags className="h-4 w-4" />刷新</Button>
                </div>
              </ConfigItem>
              <ConfigItem title="选择标签" description="合并时只能合并同类标签；删除会从所有游戏中移除此标签。">
                <div className="flex w-full max-w-[42rem] flex-col gap-3 text-left">
                  {tags.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-white/10 bg-black/[0.10] px-3 py-4 text-right text-xs text-slate-500">还没有标签。</div>
                  ) : (
                    <div className="grid gap-2 md:grid-cols-[1fr_1fr]">
                      <Select value={selectedTagId} onChange={(event) => selectTag(event.target.value)}>
                        <option value="">选择目标标签</option>
                        {tags.map((tag) => <option key={tag.id} value={tag.id}>{tagLabel(tag)}</option>)}
                      </Select>
                      <Input value={renameTagName} onChange={(event) => setRenameTagName(event.target.value)} placeholder="新标签名" />
                    </div>
                  )}
                  {selectedTagId && (
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" onClick={renameSelectedTag}>重命名</Button>
                      <Button variant="outline" onClick={mergeSelectedTags}>合并所选</Button>
                      <Button variant="ghost" onClick={deleteSelectedTag}><Trash2 className="h-4 w-4" />删除标签</Button>
                    </div>
                  )}
                  {selectedTagId && sameKindMergeCandidates().length > 0 && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {sameKindMergeCandidates().map((tag) => (
                        <label className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-black/[0.10] px-3 py-2 text-xs" key={tag.id}>
                          <span className="min-w-0 truncate text-slate-300">{tagLabel(tag)}</span>
                          <input checked={mergeSourceIds.includes(tag.id)} type="checkbox" onChange={(event) => toggleMergeSource(tag.id, event.target.checked)} />
                        </label>
                      ))}
                    </div>
                  )}
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {tags.slice(0, 18).map((tag) => <span className="rounded-full border border-white/10 bg-black/[0.12] px-2 py-1 text-xs text-slate-300" key={tag.id}>{tagLabel(tag)}</span>)}
                    </div>
                  )}
                </div>
              </ConfigItem>
            </ConfigSection>

            <ConfigSection title="存档自动备份">
              <ConfigItem title="启动前自动备份" description="启动游戏前复制已登记的存档路径到应用数据目录，并写入任务日志。">
                <SettingFlag checked={form.save_auto_backup_before_launch} label="启用" onChange={(value) => setForm((current) => ({ ...current, save_auto_backup_before_launch: value }))} />
              </ConfigItem>
              <ConfigItem title="退出后自动备份" description="游戏进程退出后再次复制存档路径。失败会进入任务日志，不删除真实存档。">
                <SettingFlag checked={form.save_auto_backup_after_exit} label="启用" onChange={(value) => setForm((current) => ({ ...current, save_auto_backup_after_exit: value }))} />
              </ConfigItem>
            </ConfigSection>

            <ConfigSection title="隐私设置">
              <ConfigItem title="隐藏敏感条目" description="游戏库默认不显示 hidden 条目。">
                <SettingFlag checked={form.privacy_hide_hidden} label="启用" onChange={(value) => setForm((current) => ({ ...current, privacy_hide_hidden: value }))} />
              </ConfigItem>
              <ConfigItem title="模糊封面" description="在列表、海报墙和详情页模糊封面。">
                <SettingFlag checked={form.privacy_blur_covers} label="启用" onChange={(value) => setForm((current) => ({ ...current, privacy_blur_covers: value }))} />
              </ConfigItem>
              <ConfigItem title="报告导出过滤 R18" description="报告页按设置排除隐藏或 R18 条目。">
                <SettingFlag checked={form.privacy_filter_reports} label="启用" onChange={(value) => setForm((current) => ({ ...current, privacy_filter_reports: value }))} />
              </ConfigItem>
            </ConfigSection>
          </TabsContent>
        </Tabs>
      </PageFrame>
    </PageShell>
  );

  function setAccentColor(value: string) {
    setForm((current) => ({ ...current, ui_accent_color: value }));
    onAccentPreview?.(value);
    setMessage(null);
  }

  function setThemeMode(value: string) {
    setForm((current) => ({ ...current, ui_theme_mode: value }));
    onThemePreview?.(value);
    setMessage(null);
  }

  async function backupDatabase() {
    setError(null);
    setMessage(null);
    try {
      const path = await chooseDatabaseBackupPath();
      if (!path) return;
      const task = await api.backupDatabase(path);
      setMessage({ text: `数据库备份任务已创建：${task.id}`, taskId: task.id });
      onSaved?.();
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  async function restoreDatabase() {
    setError(null);
    setMessage(null);
    try {
      const path = await chooseDatabaseRestorePath();
      if (!path) return;
      const ok = window.confirm('恢复会在下次启动前替换当前数据库；应用会先创建保护备份。确认安排恢复吗？');
      if (!ok) return;
      const task = await api.restoreDatabaseBackup(path);
      setMessage({ text: `数据库恢复任务已创建：${task.id}。请重启应用以应用恢复。`, taskId: task.id });
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  async function loadLogs() {
    try {
      setLogs(await api.listDiagnosticLogs(20));
    } catch {
      setLogs([]);
    }
  }

  async function loadTags() {
    try {
      const nextTags = await api.listTags();
      setTags(nextTags);
      setSelectedTagId((current) => nextTags.some((tag) => tag.id === current) ? current : '');
      setMergeSourceIds((current) => current.filter((id) => nextTags.some((tag) => tag.id === id)));
    } catch {
      setTags([]);
    }
  }

  function selectTag(id: string) {
    setSelectedTagId(id);
    const tag = tags.find((item) => item.id === id);
    setRenameTagName(tag?.name ?? '');
    setMergeSourceIds([]);
  }

  function sameKindMergeCandidates() {
    const target = tags.find((tag) => tag.id === selectedTagId);
    if (!target) return [];
    return tags.filter((tag) => tag.kind === target.kind && tag.id !== target.id);
  }

  function toggleMergeSource(id: string, checked: boolean) {
    setMergeSourceIds((current) => checked ? [...new Set([...current, id])] : current.filter((item) => item !== id));
  }

  async function renameSelectedTag() {
    setError(null);
    setMessage(null);
    try {
      if (!selectedTagId || !renameTagName.trim()) return;
      const tag = await api.renameTag(selectedTagId, renameTagName.trim());
      setMessage({ text: `标签已重命名为：${tag.name}` });
      await loadTags();
      setSelectedTagId(tag.id);
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  async function mergeSelectedTags() {
    setError(null);
    setMessage(null);
    try {
      if (!selectedTagId || mergeSourceIds.length === 0) return;
      const tag = await api.mergeTags(mergeSourceIds, selectedTagId);
      setMessage({ text: `已合并 ${mergeSourceIds.length} 个标签到：${tag.name}` });
      setMergeSourceIds([]);
      await loadTags();
      onSaved?.();
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  async function deleteSelectedTag() {
    setError(null);
    setMessage(null);
    try {
      const tag = tags.find((item) => item.id === selectedTagId);
      if (!tag) return;
      if (!window.confirm(`从所有游戏移除标签“${tag.name}”？不会删除游戏条目。`)) return;
      await api.deleteTag(tag.id);
      setMessage({ text: `标签已删除：${tag.name}` });
      setSelectedTagId('');
      setRenameTagName('');
      setMergeSourceIds([]);
      await loadTags();
      onSaved?.();
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  async function pruneLogs() {
    setError(null);
    setMessage(null);
    try {
      const policy = await api.getLogRetention();
      const removed = await api.pruneDiagnosticLogs(policy);
      setMessage({ text: removed > 0 ? `已清理 ${removed} 个过期日志。` : '没有需要清理的过期日志。' });
      await loadLogs();
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  async function testAiConnection() {
    setTestingAi(true);
    setError(null);
    setMessage(null);
    try {
      await api.setAppSettings({
        ai_base_url: form.ai_base_url,
        ai_model: form.ai_model,
        ai_api_key: form.ai_api_key,
      });
      const result = await api.testAiConnection();
      setMessage({ text: `AI 连接可用：${result.model} · ${result.baseUrl}` });
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setTestingAi(false);
    }
  }

  async function pickArchiveDir() {
    const selected = await chooseArchiveDirectory(archiveDir);
    if (selected) setArchiveDir(selected);
  }

  async function pickArchivePath() {
    const selected = await chooseArchivePath(archiveDir);
    if (selected) setArchiveDir(selected);
  }

  async function loadLibraryRoots() {
    try {
      setLibraryRoots(await api.listLibraryRoots());
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  async function pickLibraryRoot() {
    const selected = await chooseDirectory(libraryRootPath);
    if (selected) setLibraryRootPath(selected);
  }

  async function addLibraryRoot() {
    setError(null);
    setMessage(null);
    try {
      const path = libraryRootPath.trim() || await chooseDirectory(libraryRootPath);
      if (!path) return;
      await api.addLibraryRoot(path);
      setLibraryRootPath('');
      setMessage({ text: '库目录已添加。扫描会先生成候选，由你确认后才写入数据库。' });
      await loadLibraryRoots();
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  async function updateLibraryRoot(root: LibraryRoot, input: { recursive?: boolean; enabled?: boolean }) {
    setRootActionId(root.id);
    setError(null);
    try {
      await api.updateLibraryRoot(root.id, input);
      await loadLibraryRoots();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setRootActionId(null);
    }
  }

  async function removeLibraryRoot(root: LibraryRoot) {
    if (!window.confirm('移除这个库目录记录？不会删除真实文件，也不会删除已入库游戏。')) return;
    setRootActionId(root.id);
    setError(null);
    try {
      await api.removeLibraryRoot(root.id);
      setMessage({ text: '库目录记录已移除，不影响真实文件和已入库游戏。' });
      await loadLibraryRoots();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setRootActionId(null);
    }
  }

  async function scanLibraryRoot(root: LibraryRoot) {
    setRootActionId(root.id);
    setError(null);
    setMessage(null);
    try {
      const task = await api.startScanTask(root.path, root.recursive);
      setMessage({ text: `已创建库目录扫描任务：${task.id}。请到扫描入库或任务页查看候选与进度。`, taskId: task.id });
      onSaved?.();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setRootActionId(null);
    }
  }

  async function exportArchive() {
    setError(null);
    setMessage(null);
    try {
      const targetDir = archiveDir.trim() || await chooseArchiveDirectory(archiveDir);
      if (!targetDir) return;
      setArchiveDir(targetDir);
      const task = await api.exportLibraryArchive({ targetDir, includeImages, includeSaveBackups });
      setMessage({ text: `库归档导出任务已创建：${task.id}`, taskId: task.id });
      onSaved?.();
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  async function exportArchiveZip() {
    setError(null);
    setMessage(null);
    try {
      const targetDir = archiveDir.trim() || await chooseArchiveDirectory(archiveDir);
      if (!targetDir) return;
      setArchiveDir(targetDir);
      const task = await api.exportLibraryArchiveZip({ targetDir, includeImages, includeSaveBackups });
      setMessage({ text: `ZIP 库归档导出任务已创建：${task.id}`, taskId: task.id });
      onSaved?.();
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  async function previewArchive() {
    setError(null);
    setMessage(null);
    try {
      const targetDir = archiveDir.trim() || await chooseArchiveDirectory(archiveDir);
      if (!targetDir) return;
      setArchiveDir(targetDir);
      const preview = await api.previewLibraryArchive(targetDir);
      setArchivePreview(preview);
      setMessage({ text: '归档预览已读取。安全导入会自动备份当前数据库并跳过冲突条目。' });
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  async function importArchive() {
    setError(null);
    setMessage(null);
    try {
      const targetDir = archivePreview?.archiveDir || archiveDir.trim() || await chooseArchiveDirectory(archiveDir);
      if (!targetDir) return;
      if (!window.confirm('安全导入会先备份当前数据库，然后只合并不冲突的新记录。继续？')) return;
      setArchiveDir(targetDir);
      const task = await api.importLibraryArchive({ archiveDir: targetDir, includeImages, includeSaveBackups });
      setMessage({ text: `库归档安全导入任务已创建：${task.id}`, taskId: task.id });
      onSaved?.();
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }
}

function EditableField({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return <Input className="w-72 max-w-[calc(100vw-5rem)] sm:max-w-[18rem]" type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />;
}

function SettingFlag({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <CheckboxField checked={checked} className="min-w-24" label={label} onChange={(event) => onChange(event.target.checked)} />;
}

function tagLabel(tag: TagRecord) {
  return `${tag.kind === 'genre' ? '类型' : '标签'} · ${tag.name} (${tag.gameCount})`;
}

const accentOptions = [
  { id: 'vnite', label: 'Vnite', color: 'rgb(91 118 183)' },
  { id: 'rose', label: '樱粉', color: 'rgb(251 113 133)' },
  { id: 'teal', label: '青绿', color: 'rgb(94 234 212)' },
  { id: 'blue', label: '天蓝', color: 'rgb(125 211 252)' },
  { id: 'amber', label: '琥珀', color: 'rgb(252 211 77)' },
];

const themeModeOptions = [
  { id: 'dark', label: '深色' },
  { id: 'light', label: '浅色' },
  { id: 'system', label: '跟随系统' },
];
