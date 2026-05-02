type ValidationResult = {
  valid: boolean;
  version: 4 | 6 | null;
  is_private: boolean;
  is_loopback: boolean;
  is_multicast: boolean;
  is_link_local: boolean;
  is_documentation: boolean;
  normalized: string | null;
};

const invalidResult: ValidationResult = {
  valid: false,
  version: null,
  is_private: false,
  is_loopback: false,
  is_multicast: false,
  is_link_local: false,
  is_documentation: false,
  normalized: null,
};

function parseIpv4(ip: string): number[] | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;

  const bytes = parts.map((part) => {
    if (!/^(?:0|[1-9]\d{0,2})$/.test(part)) return null;
    const value = Number(part);
    return value <= 255 ? value : null;
  });

  return bytes.every((byte) => byte !== null) ? (bytes as number[]) : null;
}

function validateIpv4(ip: string): ValidationResult | null {
  const bytes = parseIpv4(ip);
  if (!bytes) return null;

  const [a, b, c] = bytes;
  const isLoopback = a === 127;
  const isLinkLocal = a === 169 && b === 254;
  const isMulticast = a >= 224 && a <= 239;
  const isDocumentation =
    (a === 192 && b === 0 && c === 2) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113);
  const isRfc1918 =
    a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);

  return {
    valid: true,
    version: 4,
    is_private: isRfc1918 || isLoopback || isLinkLocal,
    is_loopback: isLoopback,
    is_multicast: isMulticast,
    is_link_local: isLinkLocal,
    is_documentation: isDocumentation,
    normalized: bytes.join("."),
  };
}

function parseIpv6Piece(piece: string): number[] | null {
  if (!piece) return [];
  const rawGroups = piece.split(":");
  const groups: number[] = [];

  for (let i = 0; i < rawGroups.length; i++) {
    const group = rawGroups[i];
    if (!group) return null;

    if (group.includes(".")) {
      if (i !== rawGroups.length - 1) return null;
      const ipv4 = parseIpv4(group);
      if (!ipv4) return null;
      groups.push((ipv4[0] << 8) | ipv4[1], (ipv4[2] << 8) | ipv4[3]);
      continue;
    }

    if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return null;
    groups.push(parseInt(group, 16));
  }

  return groups;
}

function parseIpv6(ip: string): number[] | null {
  if (!ip || ip.includes("%")) return null;
  const doubleColonMatches = ip.match(/::/g) ?? [];
  if (doubleColonMatches.length > 1) return null;

  if (doubleColonMatches.length === 0) {
    const groups = parseIpv6Piece(ip);
    return groups && groups.length === 8 ? groups : null;
  }

  const [leftRaw, rightRaw] = ip.split("::");
  const left = parseIpv6Piece(leftRaw);
  const right = parseIpv6Piece(rightRaw);
  if (!left || !right) return null;

  const missing = 8 - left.length - right.length;
  if (missing < 1) return null;

  return [...left, ...Array(missing).fill(0), ...right];
}

function canonicalIpv6(groups: number[]): string {
  const parts = groups.map((group) => group.toString(16));
  let bestStart = -1;
  let bestLength = 0;
  let currentStart = -1;
  let currentLength = 0;

  for (let i = 0; i < parts.length; i++) {
    if (groups[i] === 0) {
      if (currentStart === -1) currentStart = i;
      currentLength += 1;
      if (currentLength > bestLength) {
        bestStart = currentStart;
        bestLength = currentLength;
      }
    } else {
      currentStart = -1;
      currentLength = 0;
    }
  }

  if (bestLength < 2) return parts.join(":");

  const left = parts.slice(0, bestStart).join(":");
  const right = parts.slice(bestStart + bestLength).join(":");
  if (!left && !right) return "::";
  if (!left) return `::${right}`;
  if (!right) return `${left}::`;
  return `${left}::${right}`;
}

function validateIpv6(ip: string): ValidationResult | null {
  const groups = parseIpv6(ip);
  if (!groups) return null;

  const first = groups[0];
  const second = groups[1];
  const isLoopback = groups.slice(0, 7).every((group) => group === 0) && groups[7] === 1;
  const isMulticast = (first & 0xff00) === 0xff00;
  const isLinkLocal = first >= 0xfe80 && first <= 0xfebf;
  const isUniqueLocal = (first & 0xfe00) === 0xfc00;
  const isDocumentation = first === 0x2001 && second === 0x0db8;

  return {
    valid: true,
    version: 6,
    is_private: isUniqueLocal || isLoopback || isLinkLocal,
    is_loopback: isLoopback,
    is_multicast: isMulticast,
    is_link_local: isLinkLocal,
    is_documentation: isDocumentation,
    normalized: canonicalIpv6(groups),
  };
}

export function validateIp(value: unknown): ValidationResult {
  if (typeof value !== "string") return invalidResult;
  const ip = value.trim();
  if (!ip) return invalidResult;

  return validateIpv4(ip) ?? validateIpv6(ip) ?? invalidResult;
}
