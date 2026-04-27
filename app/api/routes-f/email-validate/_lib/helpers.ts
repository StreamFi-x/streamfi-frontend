import type { EmailValidationReason, EmailValidationResult } from "./types";

const MAX_EMAIL_LENGTH = 254;
const MAX_LOCAL_PART_LENGTH = 64;
const MAX_DOMAIN_LABEL_LENGTH = 63;

const LOCAL_PART_ALLOWED_CHARS_RE = /^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/i;
const DOMAIN_LABEL_CHARS_RE = /^[a-z0-9-]+$/i;
const DOMAIN_TLD_RE = /^[a-z]{2,63}$/i;

const ROLE_BASED_LOCALS = new Set([
  "admin",
  "administrator",
  "billing",
  "contact",
  "help",
  "hello",
  "info",
  "marketing",
  "news",
  "noreply",
  "no-reply",
  "postmaster",
  "privacy",
  "root",
  "sales",
  "security",
  "support",
  "team",
  "webmaster",
]);

// Common disposable/temporary email providers, bundled in-folder for task isolation.
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "10minutemail.com",
  "10minutemail.net",
  "20minutemail.com",
  "2prong.com",
  "33mail.com",
  "abyssmail.com",
  "afrobacon.com",
  "anonbox.net",
  "anonymbox.com",
  "armyspy.com",
  "bccto.me",
  "beefmilk.com",
  "binkmail.com",
  "bobmail.info",
  "chacuo.net",
  "cmail.net",
  "cool.fr.nf",
  "crazymailing.com",
  "cuvox.de",
  "dayrep.com",
  "discard.email",
  "discardmail.com",
  "discardmail.de",
  "dispostable.com",
  "dodgeit.com",
  "dodgit.com",
  "dumpandjunk.com",
  "dumpmail.de",
  "e4ward.com",
  "emailondeck.com",
  "emailtemporario.com.br",
  "emailwarden.com",
  "fakeinbox.com",
  "fakeinformation.com",
  "fakemail.fr",
  "filzmail.com",
  "getairmail.com",
  "getnada.com",
  "gishpuppy.com",
  "guerrillamail.biz",
  "guerrillamail.com",
  "guerrillamail.de",
  "guerrillamail.info",
  "guerrillamail.net",
  "guerrillamail.org",
  "harakirimail.com",
  "hidemail.de",
  "hush.ai",
  "incognitomail.com",
  "inboxbear.com",
  "incognitomail.org",
  "jetable.com",
  "jetable.fr.nf",
  "kasmail.com",
  "killmail.com",
  "kismail.ru",
  "kurzepost.de",
  "lifebyfood.com",
  "link2mail.net",
  "litedrop.com",
  "lookugly.com",
  "mail-temporaire.fr",
  "maildrop.cc",
  "maildrop.cf",
  "maildrop.ga",
  "maildrop.gq",
  "maildrop.ml",
  "maildrop.tk",
  "mailforspam.com",
  "mailinator.com",
  "mailinator.net",
  "mailnesia.com",
  "mailnull.com",
  "mailsac.com",
  "meltmail.com",
  "mintemail.com",
  "mytemp.email",
  "mytrashmail.com",
  "nada.email",
  "no-spam.ws",
  "nowmymail.com",
  "objectmail.com",
  "one-time.email",
  "onewaymail.com",
  "pookmail.com",
  "privy-mail.com",
  "rcpt.at",
  "receivespam.com",
  "rhyta.com",
  "shortmail.net",
  "sharklasers.com",
  "slopsbox.com",
  "spam4.me",
  "spambob.com",
  "spambob.net",
  "spambob.org",
  "spambox.us",
  "spamcannon.net",
  "spamcorptastic.com",
  "spamcowboy.com",
  "spamcowboy.net",
  "spamcowboy.org",
  "spamday.com",
  "spamfree24.org",
  "spamgourmet.com",
  "spamhereplease.com",
  "spamhole.com",
  "spamify.com",
  "spaml.de",
  "spammotel.com",
  "temp-mail.org",
  "temp-mail.io",
  "temp-mail.ru",
  "tempail.com",
  "tempmail.de",
  "tempmail.net",
  "tempmailo.com",
  "tempr.email",
  "throwawaymail.com",
  "trash-mail.com",
  "trashmail.at",
  "trashmail.com",
  "trashmail.de",
  "trashmail.net",
  "trbvm.com",
  "wegwerfmail.de",
  "wegwerfmail.net",
  "wegwerfmail.org",
  "yopmail.com",
  "yopmail.net",
  "yopmail.fr",
  "yopmail.gq",
  "yopmail.info",
]);

function uniqueReasons(reasons: EmailValidationReason[]): EmailValidationReason[] {
  return Array.from(new Set(reasons));
}

function hasDisposableDomain(domain: string): boolean {
  for (const candidate of DISPOSABLE_EMAIL_DOMAINS) {
    if (domain === candidate || domain.endsWith(`.${candidate}`)) return true;
  }
  return false;
}

function normalizeEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const atIndex = trimmed.indexOf("@");
  if (atIndex < 0) return trimmed;

  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);
  if (!local || !domain) return trimmed;

  const withoutTag = local.split("+", 1)[0];
  const gmailLike = domain === "gmail.com" || domain === "googlemail.com";
  const normalizedLocal = gmailLike ? withoutTag.replace(/\./g, "") : withoutTag;

  return `${normalizedLocal}@${domain}`;
}

/**
 * RFC 5322 subset validation:
 * - Supports common unquoted local parts and standard DNS-like domains
 * - Does not support quoted local parts, comments, IP-literal domains, or folding whitespace
 */
function syntaxReasons(normalizedEmail: string): EmailValidationReason[] {
  const reasons: EmailValidationReason[] = [];

  if (!normalizedEmail) {
    reasons.push("EMAIL_REQUIRED");
    return reasons;
  }

  if (normalizedEmail.length > MAX_EMAIL_LENGTH) {
    reasons.push("EMAIL_TOO_LONG");
  }

  const atCount = (normalizedEmail.match(/@/g) ?? []).length;
  if (atCount === 0) {
    reasons.push("MISSING_AT_SYMBOL");
    return uniqueReasons(reasons);
  }
  if (atCount > 1) {
    reasons.push("MULTIPLE_AT_SYMBOLS");
    return uniqueReasons(reasons);
  }

  const [local, domain] = normalizedEmail.split("@");

  if (!local) reasons.push("MISSING_LOCAL_PART");
  if (!domain) reasons.push("MISSING_DOMAIN");
  if (!local || !domain) return uniqueReasons(reasons);

  if (local.includes('"')) {
    reasons.push("UNSUPPORTED_QUOTED_LOCAL_PART");
  }
  if (local.length > MAX_LOCAL_PART_LENGTH) {
    reasons.push("LOCAL_PART_TOO_LONG");
  }
  if (local.startsWith(".") || local.endsWith(".")) {
    reasons.push("LOCAL_PART_STARTS_OR_ENDS_WITH_DOT");
  }
  if (local.includes("..")) {
    reasons.push("LOCAL_PART_CONSECUTIVE_DOTS");
  }
  if (!LOCAL_PART_ALLOWED_CHARS_RE.test(local)) {
    reasons.push("LOCAL_PART_INVALID_CHARACTERS");
  }

  if (!domain.includes(".")) {
    reasons.push("DOMAIN_MISSING_DOT");
    return uniqueReasons(reasons);
  }

  const labels = domain.split(".");
  const tld = labels[labels.length - 1] ?? "";

  for (const label of labels) {
    if (!label) {
      reasons.push("DOMAIN_LABEL_EMPTY");
      continue;
    }
    if (label.length > MAX_DOMAIN_LABEL_LENGTH) {
      reasons.push("DOMAIN_LABEL_TOO_LONG");
    }
    if (label.startsWith("-") || label.endsWith("-")) {
      reasons.push("DOMAIN_LABEL_STARTS_OR_ENDS_WITH_HYPHEN");
    }
    if (!DOMAIN_LABEL_CHARS_RE.test(label)) {
      reasons.push("DOMAIN_LABEL_INVALID_CHARACTERS");
    }
  }

  if (!DOMAIN_TLD_RE.test(tld)) {
    reasons.push("DOMAIN_TLD_INVALID");
  }

  return uniqueReasons(reasons);
}

export function validateEmail(email: string): EmailValidationResult {
  const normalized = normalizeEmail(email);
  const reasons = syntaxReasons(normalized);

  const atIndex = normalized.indexOf("@");
  const local = atIndex >= 0 ? normalized.slice(0, atIndex) : "";
  const domain = atIndex >= 0 ? normalized.slice(atIndex + 1) : "";

  const is_role_based = ROLE_BASED_LOCALS.has(local);
  const is_disposable = domain ? hasDisposableDomain(domain) : false;

  return {
    valid: reasons.length === 0,
    reasons,
    is_disposable,
    is_role_based,
    normalized,
  };
}
