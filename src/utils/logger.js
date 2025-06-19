import fs from 'fs';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR);
}

function getLogFilePath() {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return path.join(LOG_DIR, `app-${date}.log`);
}

function writeLog(level, msg, meta) {
  const logEntry = `[${level}] ${new Date().toISOString()} ${msg} ${meta ? JSON.stringify(meta) : ''}\n`;
  fs.appendFile(getLogFilePath(), logEntry, err => {
    if (err) console.error('[LOGGER ERROR] Failed to write log file:', err);
  });
}

export const logger = {
  info: (msg, meta) => {
    console.log('[INFO]', msg, meta || '');
    writeLog('INFO', msg, meta);
  },
  error: (msg, meta) => {
    console.error('[ERROR]', msg, meta || '');
    writeLog('ERROR', msg, meta);
  },
  debug: (msg, meta) => {
    console.debug('[DEBUG]', msg, meta || '');
    writeLog('DEBUG', msg, meta);
  },
  verbose: (msg, meta) => {
    console.log('[VERBOSE]', msg, meta || '');
    writeLog('VERBOSE', msg, meta);
  }
};
