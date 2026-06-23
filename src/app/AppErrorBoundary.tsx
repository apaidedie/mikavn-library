import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ClipboardCopy, FileArchive, RotateCcw } from 'lucide-react';
import { DiagnosticExportPathActions } from '@/components/diagnostics/DiagnosticExportPathActions';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { api } from '@/services/api';
import { redactDiagnosticText } from '@/utils/diagnosticRedaction';
import { errorMessage } from '@/utils/errorMessage';

type AppErrorBoundaryState = {
  error: Error | null;
  componentStack: string | null;
  exporting: boolean;
  exportMessage: string | null;
  exportPath: string | null;
};

export class AppErrorBoundary extends Component<{ children: ReactNode }, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null, componentStack: null, exporting: false, exportMessage: null, exportPath: null };

  static getDerivedStateFromError(error: Error): Partial<AppErrorBoundaryState> { return { error }; }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('MikaVN render failure', error, info.componentStack);
    this.setState({ componentStack: info.componentStack || null });
  }

  private copyErrorSummary = async () => {
    const error = this.state.error;
    const summary = [
      'MikaVN Library render failure',
      `Message: ${error?.message || 'unknown error'}`,
      error?.stack ? `Stack:\n${error.stack}` : '',
      this.state.componentStack ? `Component stack:\n${this.state.componentStack}` : '',
    ].filter(Boolean).join('\n\n');
    try {
      await navigator.clipboard.writeText(redactDiagnosticText(summary));
      this.setState({ exportMessage: '错误摘要已复制。' });
    } catch (reason) {
      this.setState({ exportMessage: `复制错误摘要失败：${errorMessage(reason)}` });
    }
  };

  private exportDiagnosticPackage = async () => {
    this.setState({ exporting: true, exportMessage: null, exportPath: null });
    try {
      const report = await api.exportDiagnosticPackage();
      this.setState({
        exportMessage: `诊断包已导出：${report.fileName}。不包含完整数据库、图片缓存或存档文件。`,
        exportPath: report.path,
      });
    } catch (reason) {
      this.setState({ exportMessage: `诊断包导出失败：${errorMessage(reason)}` });
    } finally {
      this.setState({ exporting: false });
    }
  };

  private revealDiagnosticPackage = async () => {
    if (!this.state.exportPath) return;
    try {
      await api.revealPath(this.state.exportPath);
    } catch (reason) {
      this.setState({ exportMessage: `打开诊断包位置失败：${errorMessage(reason)}` });
    }
  };

  private copyDiagnosticPackagePath = async () => {
    if (!this.state.exportPath) return;
    try {
      await navigator.clipboard.writeText(this.state.exportPath);
      this.setState({ exportMessage: '诊断包路径已复制。' });
    } catch (reason) {
      this.setState({ exportMessage: `复制诊断包路径失败：${errorMessage(reason)}` });
    }
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-[rgb(var(--app-bg-rgb))] p-6 text-slate-100">
        <div className="w-full max-w-2xl space-y-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">MikaVN Library</div>
            <h1 className="mt-2 text-2xl font-semibold">启动或界面渲染失败</h1>
            <p className="mt-2 text-sm text-slate-400">应用没有继续渲染。可以先导出诊断包，再重载界面或重新启动应用。</p>
          </div>
          <Notice tone="error">
            <div className="break-all text-sm">{errorMessage(this.state.error) || '未知渲染错误'}</div>
            {this.state.exportMessage && <div className="mt-2 break-all text-xs opacity-90">{this.state.exportMessage}</div>}
          </Notice>
          <div className="flex flex-wrap gap-2">
            <Button disabled={this.state.exporting} variant="secondary" onClick={() => void this.exportDiagnosticPackage()}><FileArchive className="h-4 w-4" />{this.state.exporting ? '导出中' : '导出诊断包'}</Button>
            <Button variant="outline" onClick={() => void this.copyErrorSummary()}><ClipboardCopy className="h-4 w-4" />复制错误摘要</Button>
            {this.state.exportPath && <DiagnosticExportPathActions path={this.state.exportPath} onCopy={this.copyDiagnosticPackagePath} onReveal={this.revealDiagnosticPackage} />}
            <Button variant="outline" onClick={() => window.location.reload()}><RotateCcw className="h-4 w-4" />重载界面</Button>
          </div>
        </div>
      </div>
    );
  }
}
