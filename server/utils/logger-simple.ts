// server/utils/logger-simple.ts
// Ultra-lightweight logger - no files, minimal overhead
export const logger = {
  info: (...args: any[]) => {
    if (process.env.LOG_LEVEL !== 'error') {
      console.log('[INFO]', new Date().toISOString(), ...args);
    }
  },
  
  error: (...args: any[]) => {
    console.error('[ERROR]', new Date().toISOString(), ...args);
  },
  
  warn: (...args: any[]) => {
    if (process.env.LOG_LEVEL !== 'error') {
      console.warn('[WARN]', new Date().toISOString(), ...args);
    }
  },
  
  debug: (...args: any[]) => {
    if (process.env.LOG_LEVEL === 'debug') {
      console.log('[DEBUG]', new Date().toISOString(), ...args);
    }
  }
};
