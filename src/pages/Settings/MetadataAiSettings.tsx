import { Bot, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfigItem, ConfigSection } from '@/components/ui/config-item';
import { Input } from '@/components/ui/input';
import type { MetadataSourceRecord } from '@/types/metadata';
import { SettingFlag } from './SettingFlag';
import type { SettingsForm } from './settingsTypes';

type MetadataAiSettingsProps = {
  form: SettingsForm;
  metadataSources: MetadataSourceRecord[];
  testingAi: boolean;
  onFormChange: (update: Partial<SettingsForm>) => void;
  onTestAiConnection: () => void;
};

export function MetadataAiSettings({ form, metadataSources, testingAi, onFormChange, onTestAiConnection }: MetadataAiSettingsProps) {
  return (
    <>
      <ConfigSection title="元数据数据源">
        {metadataSources.length > 0 && (
          <ConfigItem title="来源注册表" description="来自归一化 metadata_sources 表，供后续来源优先级与扩展使用。">
            <div className="flex flex-wrap justify-end gap-1.5">
              {metadataSources.map((source) => <span className="rounded-full border border-white/10 bg-black/[0.12] px-2 py-1 text-xs text-slate-300" key={source.id}>{source.label} · {source.priority}</span>)}
            </div>
          </ConfigItem>
        )}
        <ConfigItem title="启用 VNDB" description="用于视觉小说基础元数据、标签和开发商信息。">
          <SettingFlag checked={form.provider_vndb_enabled} label="VNDB" onChange={(value) => onFormChange({ provider_vndb_enabled: value })} />
        </ConfigItem>
        <ConfigItem title="启用 Bangumi" description="用于保留和同步 Bangumi 外部 ID，供后续扩展检索使用。">
          <SettingFlag checked={form.provider_bangumi_enabled} label="Bangumi" onChange={(value) => onFormChange({ provider_bangumi_enabled: value })} />
        </ConfigItem>
        <ConfigItem title="启用 DLsite" description="仅检索公开页面和公开搜索结果。">
          <SettingFlag checked={form.provider_dlsite_enabled} label="DLsite" onChange={(value) => onFormChange({ provider_dlsite_enabled: value })} />
        </ConfigItem>
        <ConfigItem title="启用 FANZA" description="失败时只记录 provider 级错误，不中断整体搜索。">
          <SettingFlag checked={form.provider_fanza_enabled} label="FANZA" onChange={(value) => onFormChange({ provider_fanza_enabled: value })} />
        </ConfigItem>
        <ConfigItem title="启用 YMGal" description="用于保留和同步 YMGal 外部 ID，供后续扩展检索使用。">
          <SettingFlag checked={form.provider_ymgal_enabled} label="YMGal" onChange={(value) => onFormChange({ provider_ymgal_enabled: value })} />
        </ConfigItem>
      </ConfigSection>

      <ConfigSection title="AI 图片识别">
        <ConfigItem title="API Key" description="优先推荐使用环境变量 MIKAVN_AI_API_KEY。">
          <EditableField type="password" value={form.ai_api_key} onChange={(value) => onFormChange({ ai_api_key: value })} placeholder="本机私有配置" />
        </ConfigItem>
        <ConfigItem title="Base URL">
          <EditableField value={form.ai_base_url} onChange={(value) => onFormChange({ ai_base_url: value })} placeholder="https://api.example.com/v1" />
        </ConfigItem>
        <ConfigItem title="Model">
          <EditableField value={form.ai_model} onChange={(value) => onFormChange({ ai_model: value })} placeholder="gpt-4o-mini" />
        </ConfigItem>
        <ConfigItem title="测试连接" description="会先保存当前 AI 配置，再发送一次最小文本请求；不会上传图片，也不会显示 API Key。">
          <Button disabled={testingAi} variant="secondary" onClick={onTestAiConnection}>
            {testingAi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
            {testingAi ? '测试中...' : '测试 AI'}
          </Button>
        </ConfigItem>
      </ConfigSection>
    </>
  );
}

function EditableField({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return <Input className="w-72 max-w-[calc(100vw-5rem)] sm:max-w-[18rem]" type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />;
}
