import { CheckboxField } from '@/components/ui/checkbox';

type SettingFlagProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export function SettingFlag({ label, checked, onChange }: SettingFlagProps) {
  return <CheckboxField checked={checked} className="min-w-24" label={label} onChange={(event) => onChange(event.target.checked)} />;
}
