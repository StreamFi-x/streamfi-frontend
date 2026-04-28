import { toASCII } from "punycode/";
import { KNOWN_TLDS } from "./tlds";

export type DomainParts = {
  subdomain?: string;
  sld: string;
  tld: string;
};

export type DomainValidationResult = {
  valid: boolean;
  normalized: string;
  tld: string | null;
  is_known_tld: boolean;
  is_idn: boolean;
  parts: DomainParts | null;
};

const IP_V4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const PROTOCOL_RE = /^[a-z][a-z0-9+.-]*:\/\//i;
const LABEL_RE = /^[a-z0-9-]+$/i;

export function validateDomain(input: string): DomainValidationResult {
  const trimmed = input.trim();
  if (!trimmed || PROTOCOL_RE.test(trimmed)) {
    return invalid("");
  }

  if (trimmed.endsWith(".")) {
    return invalid("");
  }

  let ascii: string;
  try {
    ascii = toASCII(trimmed).toLowerCase();
  } catch {
    return invalid("");
  }

  if (!ascii || ascii.length > 253 || IP_V4_RE.test(ascii) || ascii.includes(":")) {
    return invalid(ascii);
  }

  const labels = ascii.split(".");
  if (labels.length < 2) {
    return invalid(ascii);
  }

  for (const label of labels) {
    if (!label || label.length > 63 || !LABEL_RE.test(label)) {
      return invalid(ascii);
    }
    if (label.startsWith("-") || label.endsWith("-")) {
      return invalid(ascii);
    }
  }

  const tld = labels[labels.length - 1];
  const sld = labels[labels.length - 2];
  const subdomain = labels.length > 2 ? labels.slice(0, -2).join(".") : undefined;
  const isIdn = /[^\x00-\x7f]/.test(trimmed) || ascii.includes("xn--");
  const isKnown = KNOWN_TLDS.has(tld);

  return {
    valid: true,
    normalized: ascii,
    tld,
    is_known_tld: isKnown,
    is_idn: isIdn,
    parts: { subdomain, sld, tld },
  };
}

function invalid(normalized: string): DomainValidationResult {
  return {
    valid: false,
    normalized,
    tld: null,
    is_known_tld: false,
    is_idn: false,
    parts: null,
  };
}
