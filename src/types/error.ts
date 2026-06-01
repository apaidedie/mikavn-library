export type AppErrorCode =
  | 'DB_ERROR'
  | 'MIGRATION_FAILED'
  | 'IO_ERROR'
  | 'PATH_NOT_FOUND'
  | 'PATH_ACCESS_DENIED'
  | 'EXECUTABLE_NOT_FOUND'
  | 'LAUNCH_CANCELLED'
  | 'LAUNCH_FAILED'
  | 'SCAN_FAILED'
  | 'METADATA_PROVIDER_FAILED'
  | 'ASSET_DOWNLOAD_FAILED'
  | 'BACKUP_FAILED'
  | 'RESTORE_FAILED'
  | 'TASK_CANCELLED'
  | 'VALIDATION_ERROR'
  | 'UNKNOWN_ERROR'
  | string;

export type AppErrorShape = {
  code: AppErrorCode;
  message: string;
  details?: unknown;
};

export class MikaAppError extends Error implements AppErrorShape {
  code: AppErrorCode;
  details?: unknown;

  constructor(error: AppErrorShape) {
    super(error.message);
    this.name = 'MikaAppError';
    this.code = error.code;
    this.details = error.details;
  }
}

export function normalizeAppError(reason: unknown): MikaAppError {
  if (reason instanceof MikaAppError) {
    return reason;
  }

  if (isAppErrorShape(reason)) {
    return new MikaAppError(reason);
  }

  if (reason instanceof Error) {
    return new MikaAppError({ code: 'UNKNOWN_ERROR', message: reason.message });
  }

  if (typeof reason === 'string') {
    return parseStringError(reason);
  }

  return new MikaAppError({ code: 'UNKNOWN_ERROR', message: 'Unknown error' });
}

function isAppErrorShape(value: unknown): value is AppErrorShape {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.code === 'string' && typeof candidate.message === 'string';
}

function parseStringError(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (isAppErrorShape(parsed)) {
      return new MikaAppError(parsed);
    }
  } catch {
    // Tauri may still surface legacy Rust errors as plain strings.
  }

  return new MikaAppError({ code: 'UNKNOWN_ERROR', message: value });
}
