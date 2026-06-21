import { ConfigItem, ConfigSection } from '@/components/ui/config-item';
import type { TrayStatus } from '@/types/archive';
import { SettingFlag } from './SettingFlag';
import { TrayStatusPanel } from './SettingsPageParts';
import type { SettingsForm } from './settingsTypes';

type SettingsTraySectionProps = {
  form: SettingsForm;
  savedTrayEnabled: boolean;
  trayStatus: TrayStatus | null;
  onFormChange: (update: Partial<SettingsForm>) => void;
};

export function SettingsTraySection({ form, savedTrayEnabled, trayStatus, onFormChange }: SettingsTraySectionProps) {
  return (
    <ConfigSection title="后台与托盘">
      <ConfigItem title="托盘图标" description="关闭主窗口后应用仍可留在系统托盘，方便长时间任务继续运行。">
        <div className="flex flex-col items-end gap-3">
          <SettingFlag checked={form.tray_enabled} label="启用" onChange={(value) => onFormChange({ tray_enabled: value })} />
          <div className="text-right text-xs text-slate-500">{form.tray_enabled === savedTrayEnabled ? '当前托盘状态与已保存设置一致。' : '托盘设置有未保存改动，保存后立即应用。'}</div>
          <div className="text-right text-xs text-slate-500">真正退出应用请使用托盘菜单的“退出”，或关闭托盘图标后再关闭主窗口。</div>
          {trayStatus ? <TrayStatusPanel status={trayStatus} /> : <div className="text-xs text-slate-500">正在读取托盘状态。</div>}
        </div>
      </ConfigItem>
    </ConfigSection>
  );
}
