import { I18nManager, type SupportedLocale } from "@/lib/i18n/translator";
import { randomUUID } from "crypto";

/**
 * Notification template engine with i18n support.
 * Renders notification titles and bodies with interpolation and pluralization.
 */

export type NotificationType = 
  | "follow" 
  | "live" 
  | "tip_received" 
  | "new_subscriber" 
  | "stream_live" 
  | "clip_featured" 
  | "payment_confirmed" 
  | "system";

export interface NotificationTemplate {
  title: string;
  body: string;
  type: NotificationType;
}

export interface RenderedNotification {
  id: string;
  type: NotificationType;
  title: string;
  text: string;
  read: boolean;
  created_at: string;
}

export interface TemplateParams {
  [key: string]: string | number | undefined;
}

/**
 * Renders a notification using templates and i18n.
 * Handles pluralization for notifications with count.
 */
export function renderNotification(
  type: NotificationType,
  params: TemplateParams,
  locale: SupportedLocale = "en"
): NotificationTemplate {
  const i18n = new I18nManager();
  i18n.setLocale(locale);

  // Determine if we need plural form
  const count = params.count ? Number(params.count) : undefined;
  const shouldUsePlural = count !== undefined && count !== 1;

  // Get title
  const titleKey = `notifications.${type}.title`;
  const title = i18n.t(titleKey, params);

  // Get body - use plural form if applicable
  const bodyKey = shouldUsePlural 
    ? `notifications.${type}.body_plural`
    : `notifications.${type}.body`;
  
  let body = i18n.t(bodyKey, params);
  
  // Fallback to singular if plural form doesn't exist
  if (shouldUsePlural && body === bodyKey) {
    body = i18n.t(`notifications.${type}.body`, params);
  }

  return {
    title,
    body,
    type,
  };
}

/**
 * Creates a complete notification record with generated ID and timestamp.
 */
export function createNotificationRecord(
  type: NotificationType,
  params: TemplateParams,
  locale: SupportedLocale = "en"
): RenderedNotification {
  const template = renderNotification(type, params, locale);

  return {
    id: randomUUID(),
    type,
    title: template.title,
    text: template.body,
    read: false,
    created_at: new Date().toISOString(),
  };
}

/**
 * Batch render multiple notifications (useful for digest/summary operations)
 */
export function batchRenderNotifications(
  notifications: Array<{ type: NotificationType; params: TemplateParams }>,
  locale: SupportedLocale = "en"
): RenderedNotification[] {
  return notifications.map(({ type, params }) =>
    createNotificationRecord(type, params, locale)
  );
}
