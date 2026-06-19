import { Tags, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfigItem, ConfigSection } from '@/components/ui/config-item';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { TagRecord } from '@/types/game';
import { tagLabel } from './SettingsPageParts';

type SettingsTagMaintenanceSectionProps = {
  mergeSourceIds: string[];
  renameTagName: string;
  selectedTagId: string;
  tags: TagRecord[];
  onDeleteSelectedTag: () => void | Promise<void>;
  onLoadTags: () => void | Promise<void>;
  onMergeSelectedTags: () => void | Promise<void>;
  onRenameSelectedTag: () => void | Promise<void>;
  onRenameTagNameChange: (name: string) => void;
  onSelectTag: (id: string) => void;
  onToggleMergeSource: (id: string, checked: boolean) => void;
};

export function SettingsTagMaintenanceSection({
  mergeSourceIds,
  renameTagName,
  selectedTagId,
  tags,
  onDeleteSelectedTag,
  onLoadTags,
  onMergeSelectedTags,
  onRenameSelectedTag,
  onRenameTagNameChange,
  onSelectTag,
  onToggleMergeSource,
}: SettingsTagMaintenanceSectionProps) {
  const mergeCandidates = sameKindMergeCandidates(tags, selectedTagId);

  return (
    <ConfigSection title="标签维护">
      <ConfigItem title="标签总览" description="重命名、合并或删除 normalized tags/game_tags 中的标签，不会删除游戏条目。">
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => void onLoadTags()}><Tags className="h-4 w-4" />刷新</Button>
        </div>
      </ConfigItem>
      <ConfigItem title="选择标签" description="合并时只能合并同类标签；删除会从所有游戏中移除此标签。">
        <div className="flex w-full max-w-[42rem] flex-col gap-3 text-left">
          {tags.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/10 bg-black/[0.10] px-3 py-4 text-right text-xs text-slate-500">还没有标签。</div>
          ) : (
            <div className="grid gap-2 md:grid-cols-[1fr_1fr]">
              <Select value={selectedTagId} onChange={(event) => onSelectTag(event.target.value)}>
                <option value="">选择目标标签</option>
                {tags.map((tag) => <option key={tag.id} value={tag.id}>{tagLabel(tag)}</option>)}
              </Select>
              <Input value={renameTagName} onChange={(event) => onRenameTagNameChange(event.target.value)} placeholder="新标签名" />
            </div>
          )}
          {selectedTagId && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => void onRenameSelectedTag()}>重命名</Button>
              <Button variant="outline" onClick={() => void onMergeSelectedTags()}>合并所选</Button>
              <Button variant="ghost" onClick={() => void onDeleteSelectedTag()}><Trash2 className="h-4 w-4" />删除标签</Button>
            </div>
          )}
          {selectedTagId && mergeCandidates.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {mergeCandidates.map((tag) => (
                <label className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-black/[0.10] px-3 py-2 text-xs" key={tag.id}>
                  <span className="min-w-0 truncate text-slate-300">{tagLabel(tag)}</span>
                  <input checked={mergeSourceIds.includes(tag.id)} type="checkbox" onChange={(event) => onToggleMergeSource(tag.id, event.target.checked)} />
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
  );
}

function sameKindMergeCandidates(tags: TagRecord[], selectedTagId: string) {
  const target = tags.find((tag) => tag.id === selectedTagId);
  if (!target) return [];
  return tags.filter((tag) => tag.kind === target.kind && tag.id !== target.id);
}
