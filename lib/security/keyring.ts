export type Keyring = {
  activeKid: string;
  keys: Map<string, Buffer>;
};

export function currentKeyring(): Keyring {
  const configured = loadSecretKeyring("SESSION_KEYRING_JSON", "SESSION_SECRET");
  const keys = new Map<string, Buffer>();
  for (const [kid, value] of configured.keys) {
    if (value.length < 32) {throw new Error("Session signing keys must contain at least 32 characters");}
    keys.set(kid, Buffer.from(value, "utf8"));
  }
  return { activeKid: configured.activeKid, keys };
}

export type SecretKeyring = { activeKid: string; keys: Map<string, string> };

export function loadSecretKeyring(envName: string, legacyName: string): SecretKeyring {
  const raw = process.env[envName];
  if (raw) {
    let config: { activeKid?: unknown; keys?: unknown };
    try {config = JSON.parse(raw);} catch {throw new Error(`${envName} must contain JSON`);}
    if (typeof config.activeKid !== "string" || !config.keys || typeof config.keys !== "object") {
      throw new Error(`${envName} must include activeKid and keys`);
    }
    const entries = Object.entries(config.keys as Record<string, unknown>);
    if (!entries.length || entries.length > 5) {throw new Error(`${envName} must contain between one and five keys`);}
    const keys = new Map<string, string>();
    for (const [kid, value] of entries) {
      if (!/^[A-Za-z0-9_-]{1,32}$/.test(kid) || typeof value !== "string" || value.length < 16) {
        throw new Error(`${envName} contains an invalid key entry`);
      }
      keys.set(kid, value);
    }
    if (!keys.has(config.activeKid)) {throw new Error(`${envName} activeKid is missing`);}
    return { activeKid: config.activeKid, keys };
  }
  const legacy = process.env[legacyName];
  if (!legacy) {throw new Error(`${legacyName} is required until ${envName} is configured`);}
  return { activeKid: "legacy", keys: new Map([["legacy", legacy]]) };
}

type SerializedKeyring = {
  activeKid?: unknown;
  keys?: unknown;
};

export function loadKeyring(
  envName: string,
  legacyEnvName: string,
  legacyEncoding: "utf8" | "hex" = "utf8"
): Keyring {
  const raw = process.env[envName];
  if (raw) {
    let config: SerializedKeyring;
    try {
      config = JSON.parse(raw) as SerializedKeyring;
    } catch {
      throw new Error(`${envName} must contain a JSON keyring`);
    }
    if (typeof config.activeKid !== "string" || !config.keys || typeof config.keys !== "object") {
      throw new Error(`${envName} must include activeKid and keys`);
    }
    const entries = Object.entries(config.keys as Record<string, unknown>);
    if (entries.length < 1 || entries.length > 5) {
      throw new Error(`${envName} must contain between one and five keys`);
    }
    const keys = new Map<string, Buffer>();
    for (const [kid, value] of entries) {
      if (!/^[A-Za-z0-9_-]{1,32}$/.test(kid) || typeof value !== "string" || !/^[a-f0-9]{64}$/i.test(value)) {
        throw new Error(`${envName} contains an invalid key entry`);
      }
      keys.set(kid, Buffer.from(value, "hex"));
    }
    if (!keys.has(config.activeKid)) {
      throw new Error(`${envName} activeKid does not exist in keys`);
    }
    return { activeKid: config.activeKid, keys };
  }

  const legacy = process.env[legacyEnvName];
  if (!legacy) {throw new Error(`${legacyEnvName} is required until ${envName} is configured`);}
  const key = legacyEncoding === "hex" ? Buffer.from(legacy, "hex") : Buffer.from(legacy, "utf8");
  if (!key.length) {throw new Error(`${legacyEnvName} is invalid`);}
  return { activeKid: "legacy", keys: new Map([["legacy", key]]) };
}

export function activeKey(keyring: Keyring): { kid: string; key: Buffer } {
  const key = keyring.keys.get(keyring.activeKid);
  if (!key) {throw new Error("Active key is missing from keyring");}
  return { kid: keyring.activeKid, key };
}