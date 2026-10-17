/**
 * Pseudonymous viewer ids for Mux Data (`viewer_user_id`), #757.
 *
 * Mux Data is a third party, so it never receives a wallet address or an
 * internal user id. Signed-in viewers are mapped to a salted SHA-256 digest
 * of their id: stable (the same viewer is one viewer across sessions and
 * streams) but not reversible. Logged-out viewers get a random id kept in
 * localStorage so repeat visits from one browser still count as one viewer;
 * when storage is unavailable the id lasts for the page view only.
 */

const HASH_NAMESPACE = "streamfi:mux-viewer:v1:";
const ANON_STORAGE_KEY = "streamfi:mux-anon-viewer-id";
const ANON_PREFIX = "anon-";

function randomId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) {
    return c.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (c?.getRandomValues) {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

/** Random id for a viewer who is not signed in; persisted when possible. */
export function getAnonymousViewerId(): string {
  try {
    const existing = window.localStorage.getItem(ANON_STORAGE_KEY);
    if (existing) {
      return existing;
    }
    const created = `${ANON_PREFIX}${randomId()}`;
    window.localStorage.setItem(ANON_STORAGE_KEY, created);
    return created;
  } catch {
    return `${ANON_PREFIX}${randomId()}`;
  }
}

async function sha256Hex(value: string): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    return null;
  }
  const digest = await subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return Array.from(new Uint8Array(digest), b =>
    b.toString(16).padStart(2, "0")
  ).join("");
}

/**
 * The id to send to Mux Data. `identity` is the signed-in viewer's wallet
 * address or user id, or empty for a logged-out viewer. Never returns the
 * identity itself.
 */
export async function getMuxViewerId(
  identity?: string | null
): Promise<string> {
  const trimmed = identity?.trim();
  if (!trimmed) {
    return getAnonymousViewerId();
  }
  const hash = await sha256Hex(`${HASH_NAMESPACE}${trimmed}`);
  return hash ? `u-${hash.slice(0, 32)}` : getAnonymousViewerId();
}
