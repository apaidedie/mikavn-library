const REDACTED = '[redacted]';

export function redactDiagnosticText(value: string) {
  return redactWindowsUserPaths(redactSecretValues(String(value ?? '')));
}

function redactSecretValues(value: string) {
  return value
    .replace(/\b(api[_-]?key|apiKey|access[_-]?token|accessToken|refresh[_-]?token|refreshToken|client[_-]?secret|clientSecret|auth[_-]?token|authToken|id[_-]?token|idToken|private[_-]?key|privateKey|signing[_-]?key|signingKey|session(?:[_-]?id)?|sessionId|cookie|jwt|secret|token|password)\b(\s*[:=]\s*)([^\s,;]+)/gi, (_match, key: string, separator: string) => `${key}${separator}${REDACTED}`)
    .replace(/\b(authorization)\b(\s*[:=]\s*)(?:Bearer\s+)?[^\s,;]+/gi, (_match, key: string, separator: string) => `${key}${separator}${REDACTED}`);
}

function redactWindowsUserPaths(value: string) {
  return value
    .replace(/C:\\Users\\([^\\/\r\n]+)(?=\\|\/|$)/gi, 'C:\\Users\\[user]')
    .replace(/C:\/Users\/([^\\/\r\n]+)(?=\\|\/|$)/gi, 'C:/Users/[user]');
}
