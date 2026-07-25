import { NextResponse } from "next/server";

type CreatorStats = {
  creator_id: string;
  category: string;
  followers: number;
  avg_watch_minutes: number;
  conversion_rate: number;
  tips_usdc: number;
};

const CREATOR_STATS: CreatorStats[] = [
  {
    creator_id: "creator-top",
    category: "gaming",
    followers: 5200,
    avg_watch_minutes: 42,
    conversion_rate: 8.4,
    tips_usdc: 940,
  },
  {
    creator_id: "creator-mid",
    category: "gaming",
    followers: 3200,
    avg_watch_minutes: 31,
    conversion_rate: 6.2,
    tips_usdc: 540,
  },
  {
    creator_id: "creator-bottom",
    category: "gaming",
    followers: 1100,
    avg_watch_minutes: 14,
    conversion_rate: 2.1,
    tips_usdc: 130,
  },
  {
    creator_id: "music-top",
    category: "music",
    followers: 4100,
    avg_watch_minutes: 39,
    conversion_rate: 7.2,
    tips_usdc: 780,
  },
];

function scoreCreator(stats: CreatorStats) {
  return (
    stats.followers / 100 +
    stats.avg_watch_minutes * 10 +
    stats.conversion_rate * 50 +
    stats.tips_usdc / 10
  );
}

function buildCreatorSnapshot(stats: CreatorStats) {
  return {
    creator_id: stats.creator_id,
    category: stats.category,
    score: scoreCreator(stats),
    followers: stats.followers,
    avg_watch_minutes: stats.avg_watch_minutes,
    conversion_rate: stats.conversion_rate,
    tips_usdc: stats.tips_usdc,
  };
}

function averagePeerSnapshot(peers: CreatorStats[]) {
  const totals = peers.reduce(
    (accumulator, peer) => ({
      followers: accumulator.followers + peer.followers,
      avg_watch_minutes: accumulator.avg_watch_minutes + peer.avg_watch_minutes,
      conversion_rate: accumulator.conversion_rate + peer.conversion_rate,
      tips_usdc: accumulator.tips_usdc + peer.tips_usdc,
      score: accumulator.score + scoreCreator(peer),
    }),
    {
      followers: 0,
      avg_watch_minutes: 0,
      conversion_rate: 0,
      tips_usdc: 0,
      score: 0,
    }
  );

  const divisor = peers.length || 1;
  return {
    score: totals.score / divisor,
    followers: totals.followers / divisor,
    avg_watch_minutes: totals.avg_watch_minutes / divisor,
    conversion_rate: totals.conversion_rate / divisor,
    tips_usdc: totals.tips_usdc / divisor,
  };
}

function rankPercentile(targetScore: number, scores: number[]) {
  const sortedScores = [...scores].sort((left, right) => left - right);
  const rank = sortedScores.findIndex(score => score === targetScore);

  if (sortedScores.length <= 1) {
    return 100;
  }

  if (rank === -1) {
    return 0;
  }

  return (rank / (sortedScores.length - 1)) * 100;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const creatorId = searchParams.get("creator_id");

  if (!creatorId) {
    return NextResponse.json(
      { error: "creator_id is required." },
      { status: 400 }
    );
  }

  const creator = CREATOR_STATS.find(entry => entry.creator_id === creatorId);
  if (!creator) {
    return NextResponse.json({ error: "creator_id not found." }, { status: 404 });
  }

  const peers = CREATOR_STATS.filter(
    entry => entry.category === creator.category && entry.creator_id !== creatorId
  );

  const creatorSnapshot = buildCreatorSnapshot(creator);
  const peerAvg = averagePeerSnapshot(peers);
  const categoryScores = [
    ...peers.map(peer => scoreCreator(peer)),
    creatorSnapshot.score,
  ];

  return NextResponse.json({
    creator: creatorSnapshot,
    peer_avg: peerAvg,
    percentile: rankPercentile(creatorSnapshot.score, categoryScores),
  });
}
