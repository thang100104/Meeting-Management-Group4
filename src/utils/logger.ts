type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

function formatLog(level: LogLevel, message: string, meta?: Record<string, unknown>, requestId?: string) {
  const timestamp = new Date().toISOString();
  const reqStr = requestId ? ` [reqId=${requestId}]` : '';
  const metaStr = meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level}]${reqStr}: ${message}${metaStr}`;
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>, requestId?: string) => {
    console.log(formatLog('INFO', message, meta, requestId));
  },
  warn: (message: string, meta?: Record<string, unknown>, requestId?: string) => {
    console.warn(formatLog('WARN', message, meta, requestId));
  },
  error: (message: string, meta?: Record<string, unknown>, requestId?: string) => {
    console.error(formatLog('ERROR', message, meta, requestId));
  },
  debug: (message: string, meta?: Record<string, unknown>, requestId?: string) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(formatLog('DEBUG', message, meta, requestId));
    }
  },
};
