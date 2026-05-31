// Minimal logger wrapper so we can replace or extend logging centrally.
const logger = {
  info: (message: unknown, ...args: unknown[]) => console.log('[INFO]', message, ...args),
  warn: (message: unknown, ...args: unknown[]) => console.warn('[WARN]', message, ...args),
  error: (message: unknown, ...args: unknown[]) => console.error('[ERROR]', message, ...args),
};

export default logger;
