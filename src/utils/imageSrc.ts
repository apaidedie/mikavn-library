import { convertFileSrc } from '@tauri-apps/api/core';

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
const LOCAL_FILE_PATH_RE = /^(?:[a-z]:\\|\/)/i;

export function imageSrc(value?: string | null) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value) || value.startsWith('data:') || value.startsWith('asset:')) {
    return value;
  }
  if (isTauri && LOCAL_FILE_PATH_RE.test(value)) {
    return `http://mikavn-image.localhost/${encodeURIComponent(value)}`;
  }
  return isTauri ? convertFileSrc(value) : value;
}
