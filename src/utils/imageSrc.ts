import { convertFileSrc } from '@tauri-apps/api/core';

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export function imageSrc(value?: string | null) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value) || value.startsWith('data:') || value.startsWith('asset:')) {
    return value;
  }
  return isTauri ? convertFileSrc(value) : value;
}
