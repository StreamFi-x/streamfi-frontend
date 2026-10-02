import type {
  BanSyncStatus,
  ChannelBan,
  SubscribeInput,
  UnsubscribeInput,
} from "./types";

// creator_id -> set of banned viewer_ids
const channelBans = new Map<string, Map<string, ChannelBan>>();

// target -> sources they subscribe to
const subscribedTo = new Map<string, Set<string>>();

// source -> targets subscribed to them
const subscribedBy = new Map<string, Set<string>>();

export function addChannelBan(creator_id: string, viewer_id: string): ChannelBan {
  let bans = channelBans.get(creator_id);
  if (!bans) {
    bans = new Map();
    channelBans.set(creator_id, bans);
  }

  const existing = bans.get(viewer_id);
  if (existing) {
    return existing;
  }

  const record: ChannelBan = {
    creator_id,
    viewer_id,
    banned_at: new Date().toISOString(),
  };
  bans.set(viewer_id, record);
  return record;
}

export function subscribeToBans(
  input: SubscribeInput
): { ok: true } | { ok: false; error: string; status: number } {
  const source = input.source_creator_id.trim();
  const target = input.target_creator_id.trim();

  if (!source || !target) {
    return {
      ok: false,
      error: "source_creator_id and target_creator_id are required.",
      status: 400,
    };
  }

  if (source === target) {
    return {
      ok: false,
      error: "A creator cannot subscribe to their own ban list.",
      status: 400,
    };
  }

  let toSet = subscribedTo.get(target);
  if (!toSet) {
    toSet = new Set();
    subscribedTo.set(target, toSet);
  }

  if (toSet.has(source)) {
    return {
      ok: false,
      error: "Target creator is already subscribed to this source ban list.",
      status: 409,
    };
  }

  toSet.add(source);

  let bySet = subscribedBy.get(source);
  if (!bySet) {
    bySet = new Set();
    subscribedBy.set(source, bySet);
  }
  bySet.add(target);

  if (input.copy_existing) {
    const sourceBans = channelBans.get(source);
    if (sourceBans) {
      for (const ban of sourceBans.values()) {
        addChannelBan(target, ban.viewer_id);
      }
    }
  }

  return { ok: true };
}

export function unsubscribeFromBans(
  input: UnsubscribeInput
): { ok: true } | { ok: false; error: string; status: number } {
  const source = input.source_creator_id.trim();
  const target = input.target_creator_id.trim();

  if (!source || !target) {
    return {
      ok: false,
      error: "source_creator_id and target_creator_id are required.",
      status: 400,
    };
  }

  const toSet = subscribedTo.get(target);
  if (!toSet?.has(source)) {
    return {
      ok: false,
      error: "Subscription not found.",
      status: 404,
    };
  }

  toSet.delete(source);
  if (toSet.size === 0) {
    subscribedTo.delete(target);
  }

  const bySet = subscribedBy.get(source);
  bySet?.delete(target);
  if (bySet && bySet.size === 0) {
    subscribedBy.delete(source);
  }

  return { ok: true };
}

export function getBanSyncStatus(creator_id: string): BanSyncStatus {
  const to = subscribedTo.get(creator_id);
  const by = subscribedBy.get(creator_id);

  return {
    subscribed_to: to ? Array.from(to).sort() : [],
    subscribed_by: by ? Array.from(by).sort() : [],
  };
}

export function isViewerBannedOnChannel(
  creator_id: string,
  viewer_id: string
): boolean {
  const ownBans = channelBans.get(creator_id);
  if (ownBans?.has(viewer_id)) {
    return true;
  }

  const sources = subscribedTo.get(creator_id);
  if (!sources) {
    return false;
  }

  for (const sourceId of sources) {
    const sourceBans = channelBans.get(sourceId);
    if (sourceBans?.has(viewer_id)) {
      return true;
    }
  }

  return false;
}

export function __resetBanSyncStore(): void {
  channelBans.clear();
  subscribedTo.clear();
  subscribedBy.clear();
}

export function __seedChannelBan(creator_id: string, viewer_id: string): void {
  addChannelBan(creator_id, viewer_id);
}
