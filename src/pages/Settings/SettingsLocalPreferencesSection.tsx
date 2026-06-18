import { ConfigItem, ConfigSection } from '@/components/ui/config-item';
import { SettingFlag } from './SettingFlag';
import type { SettingsForm } from './settingsTypes';

type SettingsLocalPreferencesSectionProps = {
  form: SettingsForm;
  onFormChange: (update: Partial<SettingsForm>) => void;
};

export function SettingsLocalPreferencesSection({ form, onFormChange }: SettingsLocalPreferencesSectionProps) {
  return (
    <>
      <ConfigSection title="存档自动备份">
        <ConfigItem title="启动前自动备份" description="启动游戏前复制已登记的存档路径到应用数据目录，并写入任务日志。">
          <SettingFlag checked={form.save_auto_backup_before_launch} label="启用" onChange={(value) => onFormChange({ save_auto_backup_before_launch: value })} />
        </ConfigItem>
        <ConfigItem title="退出后自动备份" description="游戏进程退出后再次复制存档路径。失败会进入任务日志，不删除真实存档。">
          <SettingFlag checked={form.save_auto_backup_after_exit} label="启用" onChange={(value) => onFormChange({ save_auto_backup_after_exit: value })} />
        </ConfigItem>
      </ConfigSection>

      <ConfigSection title="隐私设置">
        <ConfigItem title="隐藏敏感条目" description="游戏库默认不显示 hidden 条目。">
          <SettingFlag checked={form.privacy_hide_hidden} label="启用" onChange={(value) => onFormChange({ privacy_hide_hidden: value })} />
        </ConfigItem>
        <ConfigItem title="模糊封面" description="在列表、海报墙和详情页模糊封面。">
          <SettingFlag checked={form.privacy_blur_covers} label="启用" onChange={(value) => onFormChange({ privacy_blur_covers: value })} />
        </ConfigItem>
        <ConfigItem title="报告导出过滤 R18" description="报告页按设置排除隐藏或 R18 条目。">
          <SettingFlag checked={form.privacy_filter_reports} label="启用" onChange={(value) => onFormChange({ privacy_filter_reports: value })} />
        </ConfigItem>
      </ConfigSection>
    </>
  );
}
