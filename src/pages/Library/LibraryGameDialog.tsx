import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Game, GameFormInput } from '@/types/game';
import { cn } from '@/utils/cn';
import { GameForm } from './GameForm';

type LibraryGameDialogProps = {
  game: Game | null;
  onCancel: () => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: GameFormInput) => Promise<void>;
  open: boolean;
};

export function LibraryGameDialog({ game, onCancel, onOpenChange, onSubmit, open }: LibraryGameDialogProps) {
  const isEditing = Boolean(game);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="motion-dialog-overlay fixed inset-0 z-40 bg-black/80 backdrop-blur-md" />
        <Dialog.Content className={cn('motion-dialog-content fixed left-1/2 top-1/2 z-50 max-h-[90vh] overflow-auto rounded-lg border border-white/15 bg-[rgb(var(--modal-rgb)/0.98)] p-0 shadow-2xl shadow-black/65 ring-1 ring-white/[0.04] backdrop-blur-2xl', isEditing ? 'w-[min(58rem,calc(100vw-2rem))]' : 'w-[min(44rem,calc(100vw-2rem))]')}>
          <div className="sticky top-0 z-10 flex min-h-12 items-center justify-between gap-4 border-b border-white/10 bg-black/[0.18] px-5 backdrop-blur-xl">
            <Dialog.Title className="text-base font-semibold text-slate-100">{isEditing ? '编辑游戏' : '添加游戏'}</Dialog.Title>
            <Dialog.Description className="sr-only">
              {isEditing ? '编辑当前游戏的本地路径、启动配置、媒体和元数据。' : '选择游戏目录或启动程序，并自动识别标题后检索元数据。'}
            </Dialog.Description>
            <Dialog.Close asChild><Button aria-label="关闭" size="icon" variant="ghost"><X className="h-4 w-4" /></Button></Dialog.Close>
          </div>
          <div className="p-5">
            <GameForm game={game} onSubmit={onSubmit} onCancel={onCancel} />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
