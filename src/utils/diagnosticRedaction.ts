const REDACTED = '[redacted]';
const SECRET_KEY_PATTERN = 'api[_-]?key|apiKey|access[_-]?token|accessToken|refresh[_-]?token|refreshToken|client[_-]?secret|clientSecret|auth[_-]?token|authToken|id[_-]?token|idToken|private[_-]?key|privateKey|signing[_-]?key|signingKey|session(?:[_-]?id)?|sessionId|cookie|jwt|secret|token|password';
const secretJsonFieldPattern = new RegExp(`(["'])(${SECRET_KEY_PATTERN})\\1(\\s*:\\s*)\\1[^"'\\r\\n]*\\1`, 'gi');
const authorizationJsonFieldPattern = /(["'])(authorization)\1(\s*:\s*)\1(?:Bearer\s+)?[^"'\r\n]*\1/gi;
const secretKeyValuePattern = new RegExp(`\\b(${SECRET_KEY_PATTERN})\\b(\\s*[:=]\\s*)([^\\s,;]+)`, 'gi');
const authorizationKeyValuePattern = /\b(authorization)\b(\s*[:=]\s*)(?:Bearer\s+)?[^\s,;]+/gi;

export function redactDiagnosticText(value: string) {
  return redactWindowsUserPaths(redactSecretValues(String(value ?? '')));
}

function redactSecretValues(value: string) {
  return value
    .replace(authorizationJsonFieldPattern, (_match, quote: string, key: string, separator: string) => `${quote}${key}${quote}${separator}${quote}${REDACTED}${quote}`)
    .replace(secretJsonFieldPattern, (_match, quote: string, key: string, separator: string) => `${quote}${key}${quote}${separator}${quote}${REDACTED}${quote}`)
    .replace(secretKeyValuePattern, (_match, key: string, separator: string) => `${key}${separator}${REDACTED}`)
    .replace(authorizationKeyValuePattern, (_match, key: string, separator: string) => `${key}${separator}${REDACTED}`);
}

function redactWindowsUserPaths(value: string) {
  return value
    .replace(/C:\\Users\\([^\\/\r\n]+)(?=\\|\/|$)/gi, 'C:\\Users\\[user]')
    .replace(/C:\/Users\/([^\\/\r\n]+)(?=\\|\/|$)/gi, 'C:/Users/[user]');
}
