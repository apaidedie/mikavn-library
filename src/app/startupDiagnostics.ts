import { api } from '@/services/api';
import type { AppDataDiagnostics } from '@/types/archive';

let startupAppDataDiagnosticsPromise: Promise<AppDataDiagnostics> | null = null;

export function getStartupAppDataDiagnostics() {
  if (!startupAppDataDiagnosticsPromise) {
    startupAppDataDiagnosticsPromise = api.getStartupAppDataDiagnostics().catch((reason) => {
      startupAppDataDiagnosticsPromise = null;
      throw reason;
    });
  }

  return startupAppDataDiagnosticsPromise;
}
