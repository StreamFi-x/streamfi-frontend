/* eslint-disable no-console */
import { formatTraceContext } from "./trace-context";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const SENSITIVE_KEY_PATTERN =
  /^(password|pass|secret|token|authorization|cookie|seed|private_?key|encrypted_stellar_key|secret_?key|dkim_private_key)$/i;

function getConfiguredLevel(): LogLevel {
  const raw = process.env.LOG_LEVEL?.toLowerCase().trim();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }
  return "debug";
}

function shouldEmit(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[getConfiguredLevel()];
}

export function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const extra: Record<string, unknown> = {};
    if ("code" in error && (error as { code?: unknown }).code !== undefined) {
      extra.errorCode = (error as { code?: unknown }).code;
    }
    return {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
      ...extra,
    };
  }
  if (typeof error === "string") {
    return { errorMessage: error };
  }
  if (error && typeof error === "object") {
    const obj = error as Record<string, unknown>;
    if ("error" in obj && obj.error instanceof Error) {
      const { error: innerErr, ...rest } = obj;
      return {
        ...serializeError(innerErr),
        ...sanitizeFields(rest),
      };
    }
    if ("err" in obj && obj.err instanceof Error) {
      const { err: innerErr, ...rest } = obj;
      return {
        ...serializeError(innerErr),
        ...sanitizeFields(rest),
      };
    }
    return sanitizeFields(obj);
  }
  if (error !== undefined && error !== null) {
    return { errorMessage: String(error) };
  }
  return {};
}

export function sanitizeFields(
  data?: Record<string, unknown>
): Record<string, unknown> {
  if (!data || typeof data !== "object") {
    return {};
  }
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      result[key] = "[REDACTED]";
    } else if (value instanceof Error) {
      result[key] = {
        name: value.name,
        message: value.message,
        stack: value.stack,
      };
    } else {
      result[key] = value;
    }
  }
  return result;
}

export interface StructuredLogger {
  log: (message: string, data?: Record<string, any>) => void;
  info: (message: string, data?: Record<string, any>) => void;
  warn: (message: string, data?: Record<string, any>) => void;
  error: (
    message: string,
    error?: Error | string | Record<string, any> | unknown,
    data?: Record<string, any>
  ) => void;
  debug: (message: string, data?: Record<string, any>) => void;
  child: (bindings: Record<string, unknown>) => StructuredLogger;
}

export function createLogger(
  bindings: Record<string, unknown> = {}
): StructuredLogger {
  const baseFields = sanitizeFields(bindings);

  const emit = (
    level: LogLevel,
    writer: (line: string) => void,
    message: string,
    fields: Record<string, unknown>
  ) => {
    if (!shouldEmit(level)) {
      return;
    }
    const traceContext = formatTraceContext();
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...baseFields,
      ...traceContext,
      ...fields,
    };
    writer(JSON.stringify(logEntry));
  };

  return {
    log: (message: string, data?: Record<string, any>) => {
      if (!shouldEmit("info")) {
        return;
      }
      const traceContext = formatTraceContext();
      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        level: "info",
        message,
        ...baseFields,
        ...traceContext,
        ...sanitizeFields(data),
      };
      console.log(JSON.stringify(logEntry));
    },

    info: (message: string, data?: Record<string, any>) => {
      emit("info", line => console.log(line), message, sanitizeFields(data));
    },

    warn: (message: string, data?: Record<string, any>) => {
      emit("warn", line => console.warn(line), message, sanitizeFields(data));
    },

    error: (
      message: string,
      error?: Error | string | Record<string, any> | unknown,
      data?: Record<string, any>
    ) => {
      const errorData = serializeError(error);
      const extraData = sanitizeFields(data);
      emit("error", line => console.error(line), message, {
        ...errorData,
        ...extraData,
      });
    },

    debug: (message: string, data?: Record<string, any>) => {
      emit("debug", line => console.debug(line), message, sanitizeFields(data));
    },

    child: (childBindings: Record<string, unknown>) =>
      createLogger({ ...baseFields, ...childBindings }),
  };
}

/**
 * Structured logger with trace context injection
 */
export const logger: StructuredLogger = createLogger();
