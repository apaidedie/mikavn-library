import { Copy, Folder, FolderSearch, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfigItem, ConfigSection } from '@/components/ui/config-item';
import { Input } from '@/components/ui/input';
import type { LibraryRoot } from '@/types/game';
import { SettingFlag } from './SettingFlag';

type LibraryRootsSectionProps = {
  libraryRootPath: string;
  libraryRoots: LibraryRoot[];
  rootActionId: string | null;
  onAddLibraryRoot: () => void | Promise<void>;
  onCopyDirectoryPath: (label: string, path: string) => void | Promise<void>;
  onLibraryRootPathChange: (path: string) => void;
  onPickLibraryRoot: () => void | Promise<void>;
  onRemoveLibraryRoot: (root: LibraryRoot) => void | Promise<void>;
  onScanLibraryRoot: (root: LibraryRoot) => void | Promise<void>;
  onUpdateLibraryRoot: (root: LibraryRoot, input: { recursive?: boolean; enabled?: boolean }) => void | Promise<void>;
};

export function SettingsLibraryRootsSection({
  libraryRootPath,
  libraryRoots,
  rootActionId,
  onAddLibraryRoot,
  onCopyDirectoryPath,
  onLibraryRootPathChange,
  onPickLibraryRoot,
  onRemoveLibraryRoot,
  onScanLibraryRoot,
  onUpdateLibraryRoot,
}: LibraryRootsSectionProps) {
  return (
    <ConfigSection title="库目录">
      <ConfigItem title="添加本地库目录" description="登记常用游戏根目录。扫描仍会先进入候选复核，不会直接写库。">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Input className="w-72" value={libraryRootPath} onChange={(event) => onLibraryRootPathChange(event.target.value)} placeholder="D:\\Games\\VisualNovel" />
          <Button aria-label="复制待添加库目录" disabled={!libraryRootPath.trim()} variant="ghost" onClick={() => void onCopyDirectoryPath('待添加库目录', libraryRootPath.trim())}><Copy className="h-4 w-4" />复制</Button>
          <Button variant="outline" onClick={() => void onPickLibraryRoot()}><Folder className="h-4 w-4" />选择</Button>
          <Button variant="secondary" onClick={() => void onAddLibraryRoot()}>添加</Button>
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
                  <SettingFlag checked={root.enabled} label="启用" onChange={(value) => void onUpdateLibraryRoot(root, { enabled: value })} />
                  <SettingFlag checked={root.recursive} label="递归" onChange={(value) => void onUpdateLibraryRoot(root, { recursive: value })} />
                  <Button aria-label="复制已登记库目录" disabled={rootActionId === root.id} size="sm" variant="ghost" onClick={() => void onCopyDirectoryPath('已登记库目录', root.path)}><Copy className="h-4 w-4" />复制</Button>
                  <Button disabled={!root.enabled || rootActionId === root.id} size="sm" variant="secondary" onClick={() => void onScanLibraryRoot(root)}><FolderSearch className="h-4 w-4" />扫描</Button>
                  <Button disabled={rootActionId === root.id} size="sm" variant="ghost" onClick={() => void onRemoveLibraryRoot(root)}><Trash2 className="h-4 w-4" />移除</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ConfigItem>
    </ConfigSection>
  );
}
