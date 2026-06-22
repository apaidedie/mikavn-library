import { CheckCircle2, Copy, Plus } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/notice';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SoftRow } from '@/components/ui/page';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/services/api';
import { chooseDirectory, chooseExecutable } from '@/services/dialog';
import type { Game } from '@/types/game';
import type { LaunchProfile } from '@/types/launch';
import { errorMessage } from '@/utils/errorMessage';

export function LaunchProfilesPanel({ game, profiles, selectedProfileId, onSelect, onChanged, onMessage }: { game: Game; profiles: LaunchProfile[]; selectedProfileId: string; onSelect: (id: string) => void; onChanged: (profiles: LaunchProfile[]) => void; onMessage: (message: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '默认启动',
    executablePath: game.executablePath ?? '',
    workingDirectory: game.workingDirectory ?? game.installPath,
    arguments: game.launchArgs ?? '',
    runnerType: 'direct',
    environmentVariables: '',
    localeEmulatorPath: '',
    preLaunchCommand: '',
    postLaunchCommand: '',
    runAsAdmin: false,
    compatibilityNotes: '',
  });

  const refresh = async () => onChanged(await api.listLaunchProfiles(game.id));

  const createProfile = async () => {
    if (!form.executablePath.trim()) {
      onMessage('启动程序不能为空。');
      return;
    }
    setSaving(true);
    try {
      await api.createLaunchProfile({
        gameId: game.id,
        name: form.name,
        executablePath: form.executablePath,
        workingDirectory: form.workingDirectory,
        arguments: form.arguments,
        runnerType: form.runnerType,
        environmentVariables: form.environmentVariables,
        localeEmulatorPath: form.localeEmulatorPath,
        preLaunchCommand: form.preLaunchCommand,
        postLaunchCommand: form.postLaunchCommand,
        runAsAdmin: form.runAsAdmin,
        compatibilityNotes: form.compatibilityNotes,
        isDefault: profiles.length === 0,
      });
      await refresh();
      setEditing(false);
      onMessage('启动配置已保存。');
    } catch (reason) {
      onMessage(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  };

  const setDefault = async (id: string) => {
    try {
      await api.setDefaultLaunchProfile(id);
      await refresh();
      onMessage('默认启动配置已更新。');
    } catch (reason) {
      onMessage(errorMessage(reason));
    }
  };

  const remove = async (profile: LaunchProfile) => {
    if (profile.id.startsWith('legacy-')) {
      onMessage('旧版默认启动配置来自游戏字段，请在编辑游戏中修改。');
      return;
    }
    if (!window.confirm(`删除启动配置「${profile.name}」？只删除这个启动配置记录，不会删除游戏记录，也不会删除真实游戏文件或启动程序。`)) return;
    try {
      await api.deleteLaunchProfile(profile.id);
      await refresh();
      onMessage('启动配置记录已删除，游戏记录和真实文件未受影响。');
    } catch (reason) {
      onMessage(errorMessage(reason));
    }
  };

  const pickExecutable = async (field: 'executablePath' | 'localeEmulatorPath') => {
    const selected = await chooseExecutable(form[field]);
    if (selected) setForm((current) => ({ ...current, [field]: selected }));
  };

  const pickWorkingDirectory = async () => {
    const selected = await chooseDirectory(form.workingDirectory);
    if (selected) setForm((current) => ({ ...current, workingDirectory: selected }));
  };

  const copyProfilePath = async (label: string, path: string) => {
    try {
      await navigator.clipboard.writeText(path);
      onMessage(`已复制${label}路径。`);
    } catch (reason) {
      onMessage(errorMessage(reason));
    }
  };

  const executableFieldLabel = form.runnerType === 'custom_command' ? '命令或程序' : '启动程序';

  return (
    <div className="space-y-3">
      {profiles.length === 0 ? (
        <EmptyState>还没有启动配置。可以从当前游戏路径创建一个默认配置。</EmptyState>
      ) : (
        <div className="space-y-2">
          <label className="space-y-1.5">
            <Label>用于启动</Label>
            <Select value={selectedProfileId} onChange={(event) => onSelect(event.target.value)}>
              {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}{profile.isDefault ? ' · 默认' : ''}</option>)}
            </Select>
          </label>
          {profiles.map((profile) => (
            <SoftRow className="grid gap-3 lg:grid-cols-[1fr_auto]" key={profile.id}>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-100">
                  <span>{profile.name}</span>
                  <Badge>{profile.runnerType}</Badge>
                  {profile.isDefault && <Badge><CheckCircle2 className="mr-1 h-3 w-3" />默认</Badge>}
                </div>
                <div className="mt-1 break-all font-mono text-xs text-slate-500">{profile.executablePath}</div>
                <div className="mt-1 text-xs text-slate-500">{profile.arguments || '无启动参数'}</div>
                {(profile.localeEmulatorPath || profile.preLaunchCommand || profile.postLaunchCommand || profile.environmentVariables) && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {profile.localeEmulatorPath && <Badge>Locale Emulator</Badge>}
                    {profile.environmentVariables && <Badge>环境变量</Badge>}
                    {profile.preLaunchCommand && <Badge>启动前脚本</Badge>}
                    {profile.postLaunchCommand && <Badge>结束后脚本</Badge>}
                  </div>
                )}
                {profile.compatibilityNotes && <div className="mt-2 text-xs text-slate-500">{profile.compatibilityNotes}</div>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button aria-label={`复制${profile.name}路径`} size="sm" variant="outline" onClick={() => void copyProfilePath(profile.name, profile.executablePath)}><Copy className="h-4 w-4" />复制</Button>
                <Button disabled={profile.isDefault || profile.id.startsWith('legacy-')} size="sm" variant="outline" onClick={() => setDefault(profile.id)}>设默认</Button>
                <Button size="sm" variant="ghost" onClick={() => remove(profile)}>删除</Button>
              </div>
            </SoftRow>
          ))}
        </div>
      )}

      {editing ? (
        <div className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1.5"><Label>名称</Label><Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
            <label className="space-y-1.5"><Label>类型</Label><Select value={form.runnerType} onChange={(event) => setForm((current) => ({ ...current, runnerType: event.target.value }))}><option value="direct">直接启动</option><option value="shortcut_lnk">快捷方式</option><option value="locale_emulator">Locale Emulator</option><option value="custom_command">自定义命令</option></Select></label>
          </div>
          <label className="mt-3 block space-y-1.5"><Label>{executableFieldLabel}</Label><div className="flex gap-2"><Input value={form.executablePath} onChange={(event) => setForm((current) => ({ ...current, executablePath: event.target.value }))} /><Button aria-label={`复制${executableFieldLabel}`} disabled={!form.executablePath.trim()} type="button" variant="outline" onClick={() => void copyProfilePath(executableFieldLabel, form.executablePath)}><Copy className="h-4 w-4" />复制</Button><Button type="button" variant="outline" onClick={() => void pickExecutable('executablePath')}>选择</Button></div></label>
          <label className="mt-3 block space-y-1.5"><Label>工作目录</Label><div className="flex gap-2"><Input value={form.workingDirectory} onChange={(event) => setForm((current) => ({ ...current, workingDirectory: event.target.value }))} /><Button aria-label="复制工作目录" disabled={!form.workingDirectory.trim()} type="button" variant="outline" onClick={() => void copyProfilePath('工作目录', form.workingDirectory)}><Copy className="h-4 w-4" />复制</Button><Button type="button" variant="outline" onClick={() => void pickWorkingDirectory()}>选择</Button></div></label>
          <label className="mt-3 block space-y-1.5"><Label>启动参数</Label><Input value={form.arguments} onChange={(event) => setForm((current) => ({ ...current, arguments: event.target.value }))} /></label>
          {form.runnerType === 'locale_emulator' && <label className="mt-3 block space-y-1.5"><Label>Locale Emulator 路径</Label><div className="flex gap-2"><Input value={form.localeEmulatorPath} onChange={(event) => setForm((current) => ({ ...current, localeEmulatorPath: event.target.value }))} /><Button aria-label="复制Locale Emulator" disabled={!form.localeEmulatorPath.trim()} type="button" variant="outline" onClick={() => void copyProfilePath('Locale Emulator', form.localeEmulatorPath)}><Copy className="h-4 w-4" />复制</Button><Button type="button" variant="outline" onClick={() => void pickExecutable('localeEmulatorPath')}>选择</Button></div></label>}
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="space-y-1.5"><Label>启动前命令</Label><Input value={form.preLaunchCommand} onChange={(event) => setForm((current) => ({ ...current, preLaunchCommand: event.target.value }))} /></label>
            <label className="space-y-1.5"><Label>结束后命令</Label><Input value={form.postLaunchCommand} onChange={(event) => setForm((current) => ({ ...current, postLaunchCommand: event.target.value }))} /></label>
          </div>
          <label className="mt-3 block space-y-1.5"><Label>环境变量</Label><Textarea placeholder={'KEY=value\nLANG=ja_JP'} value={form.environmentVariables} onChange={(event) => setForm((current) => ({ ...current, environmentVariables: event.target.value }))} /></label>
          <label className="mt-3 block space-y-1.5"><Label>兼容性备注</Label><Textarea value={form.compatibilityNotes} onChange={(event) => setForm((current) => ({ ...current, compatibilityNotes: event.target.value }))} /></label>
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-400"><input type="checkbox" checked={form.runAsAdmin} onChange={(event) => setForm((current) => ({ ...current, runAsAdmin: event.target.checked }))} />以管理员身份运行（UAC 启动后记录真实时长）</label>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(false)}>取消</Button>
            <Button disabled={saving} onClick={createProfile}>{saving ? '保存中...' : '保存配置'}</Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" onClick={() => setEditing(true)}><Plus className="h-4 w-4" />新增启动配置</Button>
      )}
    </div>
  );
}
