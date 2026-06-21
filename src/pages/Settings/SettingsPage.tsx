import { Database, Palette, Save, Search } from 'lucide-react';
import { DiagnosticExportPathActions } from '@/components/diagnostics/DiagnosticExportPathActions';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { PageFrame, PageHeader, PageShell } from '@/components/ui/page';
import { TaskNotice } from '@/components/ui/task-notice';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AppearanceSettings } from './AppearanceSettings';
import { MetadataAiSettings } from './MetadataAiSettings';
import { SettingsLocalTabContent } from './SettingsLocalTabContent';
import type { SettingsSection, SettingsTab } from './settingsTypes';
import { useSettingsPageActions } from './useSettingsPageActions';

export type { SettingsSection, SettingsTab } from './settingsTypes';

type SettingsPageProps = {
  tabRequest?: { tab: SettingsTab; section?: SettingsSection | null; key: number } | null;
  onAccentPreview?: (uiAccentColor: string) => void;
  onThemePreview?: (uiThemeMode: string) => void;
  onSaved?: () => void;
  onOpenTask?: (taskId: string) => void;
};

export function SettingsPage({ tabRequest, onAccentPreview, onThemePreview, onSaved, onOpenTask }: SettingsPageProps) {
  const settings = useSettingsPageActions({ tabRequest, onAccentPreview, onThemePreview, onSaved });
  const actions = settings.actions;

  return (
    <PageShell>
      <PageFrame className="max-w-[76rem] gap-6">
        <PageHeader
          title="设置"
          description="本机数据源、外观、AI 与隐私配置。"
          actions={<Button onClick={() => void actions.save()}><Save className="h-4 w-4" />保存设置</Button>}
        />
        {(settings.error || settings.message) && (
          <div className="space-y-2">
            {settings.error && <Notice className="py-2" tone="error">{settings.error}</Notice>}
            {settings.message && <TaskNotice message={settings.message.text} taskId={settings.message.taskId} onOpenTask={onOpenTask} />}
            {settings.message && settings.localData.diagnosticExportPath && (
              <div className="flex flex-wrap gap-2">
                <DiagnosticExportPathActions
                  buttonSize="sm"
                  buttonVariant="ghost"
                  path={settings.localData.diagnosticExportPath}
                  onCopy={settings.localData.copyDiagnosticExportPath}
                  onReveal={settings.localData.revealDiagnosticExportPath}
                />
              </div>
            )}
          </div>
        )}

        <Tabs value={settings.activeTab} onValueChange={(value) => actions.setActiveTab(value as SettingsTab)}>
          <TabsList className="border-b border-white/10">
            <TabsTrigger value="appearance"><Palette className="mr-2 h-4 w-4" />外观</TabsTrigger>
            <TabsTrigger value="sources"><Search className="mr-2 h-4 w-4" />数据源与 AI</TabsTrigger>
            <TabsTrigger value="local"><Database className="mr-2 h-4 w-4" />备份与本地</TabsTrigger>
          </TabsList>

          <TabsContent className="space-y-6" value="appearance">
            <AppearanceSettings form={settings.form} onAccentColorChange={actions.setAccentColor} onThemeModeChange={actions.setThemeMode} />
          </TabsContent>

          <TabsContent className="space-y-6" value="sources">
            <MetadataAiSettings
              form={settings.form}
              metadataSources={settings.metadataSources}
              testingAi={settings.testingAi}
              onFormChange={actions.updateForm}
              onTestAiConnection={actions.testAiConnection}
            />
          </TabsContent>

          <TabsContent className="space-y-6" value="local">
            <SettingsLocalTabContent
              form={settings.form}
              libraryRoots={settings.libraryRoots}
              localData={settings.localData}
              restoreFocusKey={tabRequest?.section === 'database-restore' ? tabRequest.key : 0}
              settings={settings}
            />
          </TabsContent>
        </Tabs>
      </PageFrame>
    </PageShell>
  );
}
