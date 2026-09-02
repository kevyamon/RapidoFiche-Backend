import { env } from '../config/env.config';

export type LogModule =
  | 'AUTH'
  | 'USER'
  | 'LESSON'
  | 'SUBSCRIPTION'
  | 'PAYMENT'
  | 'IMPORT'
  | 'ADMIN'
  | 'STORAGE'
  | 'SYSTEM';

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

const SENSITIVE_KEYS = [
  'password',
  'passwordhash',
  'token',
  'accesstoken',
  'refreshtoken',
  'secret',
  'apikey',
  'authorization',
  'creditcard',
  'cvv',
];

function sanitizeMetadata(meta: unknown): unknown {
  if (!meta || typeof meta !== 'object') {
    return meta;
  }

  if (Array.isArray(meta)) {
    return meta.map(sanitizeMetadata);
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_KEYS.some((sensitive) => lowerKey.includes(sensitive));

    if (isSensitive) {
      sanitized[key] = '[CONFIDENTIEL]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeMetadata(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

function writeLog(
  level: LogLevel,
  module: LogModule,
  message: string,
  meta?: unknown
): void {
  if (level === 'DEBUG' && env.isProduction) {
    return;
  }

  const timestamp = new Date().toISOString();
  const sanitizedMeta = meta ? sanitizeMetadata(meta) : undefined;

  if (env.isProduction) {
    const logEntry = {
      timestamp,
      level,
      module,
      message,
      ...(sanitizedMeta !== undefined ? { context: sanitizedMeta } : {}),
    };
    if (level === 'ERROR') {
      console.error(JSON.stringify(logEntry));
    } else if (level === 'WARN') {
      console.warn(JSON.stringify(logEntry));
    } else {
      console.log(JSON.stringify(logEntry));
    }
    return;
  }

  const prefix = `[${timestamp}] [${level}] [${module}]`;
  if (level === 'ERROR') {
    console.error(`${prefix} ${message}`, sanitizedMeta ?? '');
  } else if (level === 'WARN') {
    console.warn(`${prefix} ${message}`, sanitizedMeta ?? '');
  } else if (level === 'DEBUG') {
    console.debug(`${prefix} ${message}`, sanitizedMeta ?? '');
  } else {
    console.log(`${prefix} ${message}`, sanitizedMeta ?? '');
  }
}

export const logger = {
  info: (module: LogModule, message: string, meta?: unknown) =>
    writeLog('INFO', module, message, meta),
  warn: (module: LogModule, message: string, meta?: unknown) =>
    writeLog('WARN', module, message, meta),
  error: (module: LogModule, message: string, meta?: unknown) =>
    writeLog('ERROR', module, message, meta),
  debug: (module: LogModule, message: string, meta?: unknown) =>
    writeLog('DEBUG', module, message, meta),
};
