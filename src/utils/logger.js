export const logger = {
  info: (msg, meta) => console.log('[INFO]', msg, meta || ''),
  error: (msg, meta) => console.error('[ERROR]', msg, meta || ''),
  debug: (msg, meta) => console.debug('[DEBUG]', msg, meta || '')
};
