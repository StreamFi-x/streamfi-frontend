import type { RaidRecord, UserChannelState, OutgoingRaidPrompt } from "./types";

export const RAID_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

let raidCounter = 1;
export const raidsStore: RaidRecord[] = [];
export const channelStates = new Map<string, UserChannelState>();
export const activeOutgoingRaids = new Map<string, OutgoingRaidPrompt>();

export function initDefaultChannels() {
  channelStates.clear();
  raidsStore.length = 0;
  activeOutgoingRaids.clear();
  raidCounter = 1;

  const defaultChannels: UserChannelState[] = [
    { id: "user_raider_1", username: "streamer_alpha", is_live: true, allow_incoming_raids: true },
    { id: "user_target_1", username: "streamer_beta", is_live: true, allow_incoming_raids: true },
    { id: "user_target_opted_out", username: "streamer_privacy", is_live: true, allow_incoming_raids: false },
    { id: "user_target_offline", username: "streamer_sleeping", is_live: false, allow_incoming_raids: true },
  ];

  for (const c of defaultChannels) {
    channelStates.set(c.id, { ...c });
    channelStates.set(c.username.toLowerCase(), { ...c });
  }
}

// Initialize immediately
initDefaultChannels();

export function getChannel(idOrUsername: string): UserChannelState | undefined {
  return channelStates.get(idOrUsername) || channelStates.get(idOrUsername.toLowerCase());
}

export function setChannel(channel: UserChannelState) {
  channelStates.set(channel.id, channel);
  channelStates.set(channel.username.toLowerCase(), channel);
}

export function resetRaidStore() {
  initDefaultChannels();
}

export function initiateRaid(
  raiderId: string,
  targetUsername: string,
  viewerCount: number
): {
  success: boolean;
  code?: string;
  error?: string;
  raid?: RaidRecord;
  prompt?: OutgoingRaidPrompt;
} {
  const raider = getChannel(raiderId);
  if (!raider) {
    return { success: false, code: "RAIDER_NOT_FOUND", error: "Raider channel not found" };
  }

  if (!raider.is_live) {
    return { success: false, code: "RAIDER_NOT_LIVE", error: "Only active streamers can initiate a raid" };
  }

  // 5-minute cooldown check
  const now = Date.now();
  if (raider.last_raid_at && now - raider.last_raid_at < RAID_COOLDOWN_MS) {
    const remainingSeconds = Math.ceil((RAID_COOLDOWN_MS - (now - raider.last_raid_at)) / 1000);
    return {
      success: false,
      code: "RAID_COOLDOWN",
      error: `Raid cooldown active. Please wait ${remainingSeconds} seconds before raiding again.`,
    };
  }

  const target = getChannel(targetUsername);
  if (!target) {
    return { success: false, code: "TARGET_NOT_FOUND", error: "Target user not found" };
  }

  if (target.id === raider.id) {
    return { success: false, code: "CANNOT_RAID_SELF", error: "You cannot raid yourself" };
  }

  // Check target offline race condition
  if (!target.is_live) {
    return { success: false, code: "TARGET_OFFLINE", error: "Target streamer is offline or went offline" };
  }

  // Check target opt-out safeguard
  if (!target.allow_incoming_raids) {
    return {
      success: false,
      code: "TARGET_OPTED_OUT",
      error: "This creator has disabled incoming raids",
    };
  }

  const raidId = `raid_${String(raidCounter++).padStart(4, "0")}`;
  const raidedAt = new Date(now).toISOString();

  const raidRecord: RaidRecord = {
    id: raidId,
    raider_id: raider.id,
    raider_username: raider.username,
    target_id: target.id,
    target_username: target.username,
    viewer_count: viewerCount,
    raided_at: raidedAt,
    is_acknowledged: false,
    status: "pending",
  };

  raidsStore.push(raidRecord);
  raider.last_raid_at = now;
  setChannel(raider);

  // Set outgoing prompt for initiating viewers
  const prompt: OutgoingRaidPrompt = {
    raid_id: raidId,
    raider_username: raider.username,
    target_username: target.username,
    target_channel_url: `/${target.username}`,
    viewer_count: viewerCount,
    prompt_message: `Raid starting! Join ${raider.username} in raiding ${target.username} with ${viewerCount} viewers!`,
    expires_at: new Date(now + 90 * 1000).toISOString(), // 90 second window for viewers to join
  };

  activeOutgoingRaids.set(raider.id, prompt);
  activeOutgoingRaids.set(raider.username.toLowerCase(), prompt);

  return { success: true, raid: raidRecord, prompt };
}

export function getIncomingRaid(targetId: string): RaidRecord | null {
  const target = getChannel(targetId);
  const targetKey = target ? target.id : targetId;

  // Filter unacknowledged raids for this target within the last 15 minutes
  const fifteenMinsAgo = Date.now() - 15 * 60 * 1000;
  const pendingRaids = raidsStore
    .filter(
      (r) =>
        r.target_id === targetKey &&
        !r.is_acknowledged &&
        new Date(r.raided_at).getTime() >= fifteenMinsAgo
    )
    .sort((a, b) => new Date(b.raided_at).getTime() - new Date(a.raided_at).getTime());

  if (pendingRaids.length === 0) {
    return null;
  }

  const latest = pendingRaids[0];
  latest.is_acknowledged = true;
  latest.status = "completed";
  return latest;
}

export function getActiveOutgoingRaid(channelIdOrUsername: string): OutgoingRaidPrompt | null {
  const prompt = activeOutgoingRaids.get(channelIdOrUsername) || activeOutgoingRaids.get(channelIdOrUsername.toLowerCase());
  if (!prompt) {
    return null;
  }
  if (new Date(prompt.expires_at).getTime() < Date.now()) {
    activeOutgoingRaids.delete(channelIdOrUsername);
    return null;
  }
  return prompt;
}
