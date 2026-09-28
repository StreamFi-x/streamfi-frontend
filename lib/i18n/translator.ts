export type SupportedLocale = 'en' | 'es';

export interface TranslationDictionary {
  [key: string]: string | TranslationDictionary;
}

const EN_TRANSLATIONS: TranslationDictionary = {
  common: {
    welcome: 'Welcome to StreamFi',
    live: 'LIVE',
    viewers: '{{count}} viewer',
    viewers_plural: '{{count}} viewers',
    subscribe: 'Subscribe',
    tip: 'Send Tip',
  },
  tipping: {
    amountLabel: 'Tip Amount (XLM)',
    trustWarning: 'Recipient is a new account. Review before confirming.',
    tipSuccess: 'Successfully sent {{amount}} XLM to {{creator}}!',
  },
  errors: {
    unauthorized: 'You must be logged in to perform this action.',
    networkError: 'Network connection lost. Reconnecting...',
  },
};

const ES_TRANSLATIONS: TranslationDictionary = {
  common: {
    welcome: 'Bienvenido a StreamFi',
    live: 'EN VIVO',
    viewers: '{{count}} espectador',
    viewers_plural: '{{count}} espectadores',
    subscribe: 'Suscribirse',
    tip: 'Enviar Propina',
  },
  tipping: {
    amountLabel: 'Monto de la propina (XLM)',
    trustWarning: 'El destinatario es una cuenta nueva. Revise antes de confirmar.',
    tipSuccess: '¡Se enviaron con éxito {{amount}} XLM a {{creator}}!',
  },
  errors: {
    unauthorized: 'Debes iniciar sesión para realizar esta acción.',
    networkError: 'Conexión de red perdida. Reconectando...',
  },
};

const DICTIONARIES: Record<SupportedLocale, TranslationDictionary> = {
  en: EN_TRANSLATIONS,
  es: ES_TRANSLATIONS,
};

export class I18nManager {
  private currentLocale: SupportedLocale = 'en';

  public setLocale(locale: SupportedLocale) {
    this.currentLocale = locale;
  }

  public getLocale(): SupportedLocale {
    return this.currentLocale;
  }

  public t(key: string, params: Record<string, string | number> = {}): string {
    const keys = key.split('.');
    let dict = DICTIONARIES[this.currentLocale] || DICTIONARIES['en'];
    let val: unknown = dict;

    for (const k of keys) {
      if (val && typeof val === 'object' && k in (val as Record<string, unknown>)) {
        val = (val as Record<string, unknown>)[k];
      } else {
        val = null;
        break;
      }
    }

    // Fallback to EN if missing
    if (typeof val !== 'string') {
      let fallbackDict = DICTIONARIES['en'];
      let fallbackVal: unknown = fallbackDict;
      for (const k of keys) {
        if (fallbackVal && typeof fallbackVal === 'object' && k in (fallbackVal as Record<string, unknown>)) {
          fallbackVal = (fallbackVal as Record<string, unknown>)[k];
        } else {
          return key;
        }
      }
      val = typeof fallbackVal === 'string' ? fallbackVal : key;
    }

    let text = val as string;

    // Pluralization
    if ('count' in params && typeof params.count === 'number' && params.count !== 1) {
      const pluralKey = `${key}_plural`;
      const pluralResult = this.t(pluralKey, { ...params, count: params.count });
      if (pluralResult !== pluralKey) return pluralResult;
    }

    // Interpolation
    for (const [paramKey, paramVal] of Object.entries(params)) {
      text = text.replace(new RegExp(`{{${paramKey}}}`, 'g'), String(paramVal));
    }

    return text;
  }

  public formatCurrency(amount: number, currency = 'USD'): string {
    return new Intl.NumberFormat(this.currentLocale === 'es' ? 'es-ES' : 'en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  }

  public formatDate(date: Date): string {
    return new Intl.DateTimeFormat(this.currentLocale === 'es' ? 'es-ES' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }
}
