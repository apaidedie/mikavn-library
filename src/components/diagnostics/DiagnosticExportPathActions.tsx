import { ClipboardCopy, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

type DiagnosticExportPathActionsProps = {
  buttonSize?: 'sm';
  buttonVariant?: 'ghost' | 'outline';
  onCopy: () => void;
  onReveal: () => void;
  path: string;
};

export function DiagnosticExportPathActions({ buttonSize, buttonVariant = 'outline', onCopy, onReveal, path }: DiagnosticExportPathActionsProps) {
  if (!path) return null;

  return (
    <>
      <Button size={buttonSize} variant={buttonVariant} onClick={onReveal}>
        <FolderOpen className="h-4 w-4" />
        打开诊断包位置
      </Button>
      <Button size={buttonSize} variant={buttonVariant} onClick={onCopy}>
        <ClipboardCopy className="h-4 w-4" />
        复制诊断包路径
      </Button>
    </>
  );
}
