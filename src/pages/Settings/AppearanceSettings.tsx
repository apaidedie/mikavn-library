import { ConfigItem, ConfigSection } from '@/components/ui/config-item';
import { cn } from '@/utils/cn';
import type { SettingsForm } from './settingsTypes';

type AppearanceSettingsProps = {
  form: SettingsForm;
  onAccentColorChange: (value: string) => void;
  onThemeModeChange: (value: string) => void;
};

export function AppearanceSettings({ form, onAccentColorChange, onThemeModeChange }: AppearanceSettingsProps) {
  return (
    <ConfigSection title="主题">
      <ConfigItem title="外观模式" description="浅色模式适合白天使用；跟随系统会读取系统偏好。">
        <div className="grid grid-cols-3 gap-2">
          {themeModeOptions.map((option) => (
            <button
              className={cn('h-9 rounded-md border px-3 text-xs transition-colors', form.ui_theme_mode === option.id ? 'border-[rgb(var(--accent-rgb)/0.75)] bg-[rgb(var(--accent-rgb)/0.12)] text-slate-100' : 'border-white/10 bg-black/10 text-slate-400 hover:border-white/20')}
              key={option.id}
              onClick={() => onThemeModeChange(option.id)}
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
              onClick={() => onAccentColorChange(option.id)}
              type="button"
            >
              <span className="h-4 w-4 rounded-full" style={{ background: option.color }} />
              {option.label}
            </button>
          ))}
        </div>
      </ConfigItem>
    </ConfigSection>
  );
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
