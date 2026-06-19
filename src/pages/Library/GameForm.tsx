import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/ui/notice';
import { Select } from '@/components/ui/select';
import type { Game, GameFormInput, PlayStatus } from '@/types/game';
import { PLAY_STATUS_LABEL } from '@/types/game';
import { cn } from '@/utils/cn';
import { GameFormAdvancedSection } from './GameFormAdvancedSection';
import { Field, InputWithButton } from './GameFormControls';
import { QuickAddMetadataPanel } from './QuickAddMetadataPanel';
import { useGameFormActions } from './useGameFormActions';

type GameFormProps = {
  game?: Game | null;
  onSubmit: (input: GameFormInput) => Promise<void>;
  onCancel: () => void;
};

const statusOptions: PlayStatus[] = ['planned', 'playing', 'completed', 'paused', 'archived'];

export function GameForm({ game, onSubmit, onCancel }: GameFormProps) {
  const page = useGameFormActions(game, onSubmit);
  const actions = page.actions;

  return (
    <div className="space-y-3 text-slate-200">
      {page.error && <Notice tone="error">{page.error}</Notice>}
      {page.message && <Notice>{page.message}</Notice>}
      {!page.isEditing && (
        <QuickAddMetadataPanel
          canScrape={page.canScrape}
          form={page.form}
          scraping={page.scraping}
          scrapeCandidates={page.scrapeCandidates}
          scrapeMessage={page.scrapeMessage}
          selectedCandidateKey={page.selectedCandidateKey}
          onRescrape={() => void actions.rescrape()}
          onSelectCandidate={(candidate) => void actions.selectCandidate(candidate)}
        />
      )}

      <div className={cn('grid gap-3', page.isEditing ? 'md:grid-cols-2' : 'grid-cols-1')}>
        <Field label="标题" required><Input value={page.form.title} onChange={(event) => actions.update('title', event.target.value)} /></Field>
        {page.isEditing && <Field label="原名"><Input value={page.form.originalTitle} onChange={(event) => actions.update('originalTitle', event.target.value)} /></Field>}
        {page.isEditing && (
          <Field label="游玩状态">
            <Select className="w-full" value={page.form.playStatus} onChange={(event) => actions.update('playStatus', event.target.value)}>
              {statusOptions.map((status) => <option key={status} value={status}>{PLAY_STATUS_LABEL[status]}</option>)}
            </Select>
          </Field>
        )}
        <Field label="安装目录" required><InputWithButton copyLabel="安装目录" value={page.form.installPath} onChange={(value) => actions.update('installPath', value)} onCopy={() => void actions.copyPath('安装目录', page.form.installPath)} onPick={() => void actions.pickDirectory('installPath')} /></Field>
        <Field label="启动程序"><InputWithButton copyLabel="启动程序" value={page.form.executablePath} onChange={(value) => actions.update('executablePath', value)} onCopy={() => void actions.copyPath('启动程序', page.form.executablePath)} onPick={() => void actions.pickExecutable()} /></Field>
      </div>

      <GameFormAdvancedSection
        advancedOpen={page.advancedOpen}
        form={page.form}
        isEditing={page.isEditing}
        statusOptions={statusOptions}
        onCopyPath={(label, value) => void actions.copyPath(label, value)}
        onCopyText={(label, value) => void actions.copyText(label, value)}
        onPickDirectory={(key) => void actions.pickDirectory(key)}
        onPickImage={(key) => void actions.pickImage(key)}
        onToggle={() => actions.setAdvancedOpen((value) => !value)}
        onUpdate={actions.update}
        onUpdateBool={actions.updateBool}
      />

      <div className="sticky bottom-0 z-10 -mx-5 -mb-5 flex justify-end gap-2 border-t border-white/10 bg-[rgb(var(--modal-rgb)/0.98)] px-5 py-3 backdrop-blur-xl">
        <Button type="button" variant="ghost" onClick={onCancel}>取消</Button>
        <Button type="button" disabled={page.saving} onClick={() => void actions.submit()}>{page.saving ? '保存中...' : '保存'}</Button>
      </div>
    </div>
  );
}
