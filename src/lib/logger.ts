type Level = 'info' | 'warn' | 'error';

const write = (level: Level, message: string, context: Record<string, unknown> = {}) => {
  const entry = { level, message, ...context, time: new Date().toISOString() };
  (level === 'error' ? console.error : console.log)(JSON.stringify(entry, errorReplacer));
};

const errorReplacer = (_key: string, value: unknown) =>
  value instanceof Error ? { name: value.name, message: value.message, stack: value.stack } : value;

export const logger = {
  info: (message: string, context?: Record<string, unknown>) => write('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => write('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => write('error', message, context),
};
