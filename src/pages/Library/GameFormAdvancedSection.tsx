import { ChevronDown } from 'lucide-react';
import { CheckboxField } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { PlayStatus } from '@/types/game';
import { PLAY_STATUS_LABEL } from '@/types/game';
import { cn } from '@/utils/cn';
import { Field, InputWithButton } from './GameFormControls';
import type { GameFormState } from './gameFormMapping';

type GameFormAdvancedSectionProps = {
  advancedOpen: boolean;
  form: GameFormState;
  isEditing: boolean;
  statusOptions: PlayStatus[];
  onCopyPath: (label: string, value: string) => void;
  onCopyText: (label: string, value: string) => void;
  onPickDirectory: (key: 'installPath' | 'workingDirectory') => void;
  onPickImage: (key: 'coverImage' | 'bannerImage' | 'backgroundImage') => void;
  onToggle: () => void;
  onUpdate: (key: keyof GameFormState, value: string) => void;
  onUpdateBool: (key: 'favorite' | 'hidden', value: boolean) => void;
};

export function GameFormAdvancedSection({ advancedOpen, form, isEditing, onCopyPath, onCopyText, onPickDirectory, onPickImage, onToggle, onUpdate, onUpdateBool, statusOptions }: GameFormAdvancedSectionProps) {
  return (
    <section className="rounded-lg border border-white/10 bg-black/[0.12]">
      <button className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left" type="button" onClick={onToggle}>
        <span className="text-sm font-medium text-slate-100">{isEditing ? '详细信息' : '高级信息'}</span>
        <ChevronDown className={cn('h-4 w-4 text-slate-400 transition-transform', advancedOpen && 'rotate-180')} />
      </button>

      {advancedOpen && (
        <div className="space-y-3 border-t border-white/10 p-3">
          {!isEditing && (
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="原名"><Input value={form.originalTitle} onChange={(event) => onUpdate('originalTitle', event.target.value)} /></Field>
              <Field label="游玩状态">
                <Select className="w-full" value={form.playStatus} onChange={(event) => onUpdate('playStatus', event.target.value)}>
                  {statusOptions.map((status) => <option key={status} value={status}>{PLAY_STATUS_LABEL[status]}</option>)}
                </Select>
              </Field>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="会社 / 开发商"><Input value={form.developer} onChange={(event) => onUpdate('developer', event.target.value)} /></Field>
            <Field label="品牌"><Input value={form.brand} onChange={(event) => onUpdate('brand', event.target.value)} /></Field>
            <Field label="发行商"><Input value={form.publisher} onChange={(event) => onUpdate('publisher', event.target.value)} /></Field>
            <Field label="发售日"><Input placeholder="YYYY-MM-DD" value={form.releaseDate} onChange={(event) => onUpdate('releaseDate', event.target.value)} /></Field>
            <Field label="评分"><Input min={0} max={100} type="number" value={form.rating} onChange={(event) => onUpdate('rating', event.target.value)} /></Field>
            <Field label="年龄分级"><Input value={form.ageRating} onChange={(event) => onUpdate('ageRating', event.target.value)} /></Field>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="工作目录"><InputWithButton copyLabel="工作目录" value={form.workingDirectory} onChange={(value) => onUpdate('workingDirectory', value)} onCopy={() => onCopyPath('工作目录', form.workingDirectory)} onPick={() => onPickDirectory('workingDirectory')} /></Field>
            <Field label="启动参数"><Input value={form.launchArgs} onChange={(event) => onUpdate('launchArgs', event.target.value)} /></Field>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Field label="封面路径"><InputWithButton copyLabel="封面路径" value={form.coverImage} onChange={(value) => onUpdate('coverImage', value)} onCopy={() => onCopyPath('封面', form.coverImage)} onPick={() => onPickImage('coverImage')} /></Field>
            <Field label="横幅路径"><InputWithButton copyLabel="横幅路径" value={form.bannerImage} onChange={(value) => onUpdate('bannerImage', value)} onCopy={() => onCopyPath('横幅', form.bannerImage)} onPick={() => onPickImage('bannerImage')} /></Field>
            <Field label="背景路径"><InputWithButton copyLabel="背景路径" value={form.backgroundImage} onChange={(value) => onUpdate('backgroundImage', value)} onCopy={() => onCopyPath('背景', form.backgroundImage)} onPick={() => onPickImage('backgroundImage')} /></Field>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <CheckboxField checked={form.favorite} label="收藏" onChange={(event) => onUpdateBool('favorite', event.target.checked)} />
            <CheckboxField checked={form.hidden} label="隐藏条目" onChange={(event) => onUpdateBool('hidden', event.target.checked)} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="标签"><Input placeholder="逗号分隔" value={form.tags} onChange={(event) => onUpdate('tags', event.target.value)} /></Field>
            <Field label="类型"><Input placeholder="逗号分隔" value={form.genres} onChange={(event) => onUpdate('genres', event.target.value)} /></Field>
            <Field label="别名"><Input placeholder="逗号分隔" value={form.aliases} onChange={(event) => onUpdate('aliases', event.target.value)} /></Field>
            <Field label="VNDB ID"><InputWithButton copyLabel="VNDB ID" value={form.vndbId} onChange={(value) => onUpdate('vndbId', value)} onCopy={() => onCopyText('VNDB ID', form.vndbId)} /></Field>
            <Field label="DLsite ID"><InputWithButton copyLabel="DLsite ID" value={form.dlsiteId} onChange={(value) => onUpdate('dlsiteId', value)} onCopy={() => onCopyText('DLsite ID', form.dlsiteId)} /></Field>
            <Field label="FANZA ID"><InputWithButton copyLabel="FANZA ID" value={form.fanzaId} onChange={(value) => onUpdate('fanzaId', value)} onCopy={() => onCopyText('FANZA ID', form.fanzaId)} /></Field>
            <Field label="Bangumi ID"><InputWithButton copyLabel="Bangumi ID" value={form.bangumiId} onChange={(value) => onUpdate('bangumiId', value)} onCopy={() => onCopyText('Bangumi ID', form.bangumiId)} /></Field>
            <Field label="YMGal ID"><InputWithButton copyLabel="YMGal ID" value={form.ymgalId} onChange={(value) => onUpdate('ymgalId', value)} onCopy={() => onCopyText('YMGal ID', form.ymgalId)} /></Field>
          </div>

          <Field label="简介"><Textarea value={form.description} onChange={(event) => onUpdate('description', event.target.value)} /></Field>
          <Field label="个人备注"><Textarea placeholder="攻略进度、补丁说明、通关感想、注意事项..." value={form.notes} onChange={(event) => onUpdate('notes', event.target.value)} /></Field>
        </div>
      )}
    </section>
  );
}
