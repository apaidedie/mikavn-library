import { normalizeAppError } from '@/types/error';
import { redactDiagnosticText } from './diagnosticRedaction';

export function errorMessage(reason: unknown) {
  return redactDiagnosticText(normalizeAppError(reason).message);
}
