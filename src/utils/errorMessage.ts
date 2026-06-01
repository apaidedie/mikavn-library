import { normalizeAppError } from '@/types/error';

export function errorMessage(reason: unknown) {
  return normalizeAppError(reason).message;
}
