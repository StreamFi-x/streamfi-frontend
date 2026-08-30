import type { WatchPartyState } from "./types";

/**
 * In-memory watch party store.
 *
 * This is a practice/demo store: state lives only for the lifetime of the
 * process. A module-level Map keeps every active party keyed by party_id, with
 * a secondary index from join_code -> party_id so viewers can join by code.
 */
const parties = new Map<string, WatchPartyState>();
const joinCodeIndex = new Map<string, string>();

let counter = 0;

/** Reset all state. Intended for tests. */
export function __resetStore(): void {
  parties.clear();
  joinCodeIndex.clear();
  counter = 0;
}

function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}_${counter.toString(36)}${Date.now().toString(36)}`;
}

/** Generate a short, human-friendly uppercase join code. */
function generateJoinCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  do {
    code = "";
    for (let i = 0; i < 6; i++) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
  } while (joinCodeIndex.has(code));
  return code;
}

export function createParty(hostId: string, vodId: string): WatchPartyState {
  const party: WatchPartyState = {
    party_id: nextId("party"),
    join_code: generateJoinCode(),
    host_id: hostId,
    vod_id: vodId,
    members: [hostId],
    position_seconds: 0,
    paused: true,
    updated_at: new Date().toISOString(),
  };
  parties.set(party.party_id, party);
  joinCodeIndex.set(party.join_code, party.party_id);
  return party;
}

export function getParty(partyId: string): WatchPartyState | undefined {
  return parties.get(partyId);
}

export function getPartyByJoinCode(code: string): WatchPartyState | undefined {
  const partyId = joinCodeIndex.get(code);
  return partyId ? parties.get(partyId) : undefined;
}

export function syncParty(
  partyId: string,
  positionSeconds: number,
  paused: boolean
): WatchPartyState | undefined {
  const party = parties.get(partyId);
  if (!party) {return undefined;}
  party.position_seconds = positionSeconds;
  party.paused = paused;
  party.updated_at = new Date().toISOString();
  return party;
}

/**
 * Add a viewer to a party. Idempotent: joining twice does not duplicate the
 * member. Returns undefined if the party does not exist.
 */
export function joinParty(
  partyId: string,
  viewerId: string
): WatchPartyState | undefined {
  const party = parties.get(partyId);
  if (!party) {return undefined;}
  if (!party.members.includes(viewerId)) {
    party.members.push(viewerId);
  }
  return party;
}
