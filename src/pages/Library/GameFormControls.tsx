import { Copy } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="space-y-1.5">
      <Label>{label}{required ? ' *' : ''}</Label>
      {children}
    </label>
  );
}

export function InputWithButton({ copyLabel, value, onChange, onCopy, onPick }: { copyLabel?: string; value: string; onChange: (value: string) => void; onCopy?: () => void; onPick?: () => void }) {
  return (
    <div className="flex gap-2">
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
      {onCopy && copyLabel && <Button aria-label={copyLabel.endsWith('ID') ? `复制 ${copyLabel}` : `复制${copyLabel}`} className="shrink-0" disabled={!value.trim()} type="button" variant="outline" onClick={onCopy}><Copy className="h-4 w-4" />复制</Button>}
      {onPick && <Button className="shrink-0" type="button" variant="outline" onClick={onPick}>选择</Button>}
    </div>
  );
}
