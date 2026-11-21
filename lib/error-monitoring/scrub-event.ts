import type { ErrorEvent } from "@sentry/nextjs";

const sensitive =
  /\b(?:[GSC][A-Z2-7]{55}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b/g;

function cleanLocation(value?: string): string | undefined {
  return value
    ?.split(/[?#]/, 1)[0]
    .replace(/\/\/[^/@]+@/g, "//")
    .replace(sensitive, "[redacted]");
}

/** Keep stack coordinates and source-map identifiers. Drop arbitrary application data. */
export function scrubErrorEvent(event: ErrorEvent): ErrorEvent {
  return {
    type: undefined,
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: event.platform,
    level: event.level,
    release: event.release,
    dist: event.dist,
    environment: event.environment,
    debug_meta: event.debug_meta?.images
      ? {
          images: event.debug_meta.images.flatMap(image =>
            image.type === "sourcemap"
              ? [{ ...image, code_file: cleanLocation(image.code_file) ?? "" }]
              : []
          ),
        }
      : undefined,
    exception: event.exception?.values
      ? {
          values: event.exception.values.map(exception => ({
            type: "ApplicationError",
            value: "Application error",
            stacktrace: exception.stacktrace?.frames
              ? {
                  frames: exception.stacktrace.frames.map(frame => ({
                    filename: cleanLocation(frame.filename),
                    abs_path: cleanLocation(frame.abs_path),
                    function: cleanLocation(frame.function),
                    lineno: frame.lineno,
                    colno: frame.colno,
                    in_app: frame.in_app,
                  })),
                }
              : undefined,
          })),
        }
      : undefined,
  };
}
