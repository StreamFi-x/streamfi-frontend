import { getCurrentTraceContext, formatTraceContext } from './trace-context';

/**
 * Structured logger with trace context injection
 */
export const logger = {
  log: (message: string, data?: Record<string, any>) => {
    const traceContext = formatTraceContext();
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      message,
      ...traceContext,
      ...data,
    };
    console.log(JSON.stringify(logEntry));
  },

  info: (message: string, data?: Record<string, any>) => {
    const traceContext = formatTraceContext();
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: 'info',
      message,
      ...traceContext,
      ...data,
    };
    console.log(JSON.stringify(logEntry));
  },

  warn: (message: string, data?: Record<string, any>) => {
    const traceContext = formatTraceContext();
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: 'warn',
      message,
      ...traceContext,
      ...data,
    };
    console.warn(JSON.stringify(logEntry));
  },

  error: (message: string, error?: Error | string | Record<string, any>) => {
    const traceContext = formatTraceContext();
    const timestamp = new Date().toISOString();

    let errorData: Record<string, any> = {};
    if (error instanceof Error) {
      errorData = {
        errorMessage: error.message,
        errorStack: error.stack,
      };
    } else if (typeof error === 'string') {
      errorData = { errorMessage: error };
    } else if (error && typeof error === 'object') {
      errorData = error;
    }

    const logEntry = {
      timestamp,
      level: 'error',
      message,
      ...traceContext,
      ...errorData,
    };
    console.error(JSON.stringify(logEntry));
  },

  debug: (message: string, data?: Record<string, any>) => {
    const traceContext = formatTraceContext();
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: 'debug',
      message,
      ...traceContext,
      ...data,
    };
    console.debug(JSON.stringify(logEntry));
  },
};
