import type { DigestPreferences } from "./types";
import { SEED_PREFS } from "./seed";

let _store: Map<string, DigestPreferences> = new Map(
  Object.entries(SEED_PREFS).map(([k, v]) => [k, { ...v, sections: [...v.sections] }])
);

export function getPrefs(viewerId: string): DigestPreferences | undefined {
  return _store.get(viewerId);
}

export function upsertPrefs(prefs: DigestPreferences): void {
  _store.set(prefs.viewer_id, prefs);
}

export function resetStore(): void {
  _store = new Map(
    Object.entries(SEED_PREFS).map(([k, v]) => [k, { ...v, sections: [...v.sections] }])
  );
}
