import * as Sentry from "@sentry/nextjs";
import { scrubErrorEvent } from "@/lib/error-monitoring/scrub-event";

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    beforeBreadcrumb: () => null,
    beforeSend: scrubErrorEvent,
  });
}
