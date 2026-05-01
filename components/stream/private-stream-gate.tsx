"use client";

import Image from "next/image";
import Link from "next/link";
import { Lock } from "lucide-react";

interface PrivateStreamGateProps {
  username: string;
  privacy: "unlisted" | "subscribers_only";
  reason: string | null;
  avatar: string | null;
}

const COPY: Record<string, { title: string; body: string }> = {
  unlisted: {
    title: "This stream is unlisted",
    body: "You need an invite link from the creator to watch this stream.",
  },
  subscribers_only: {
    title: "This stream is for supporters",
    body: "Only people with an invite link from the creator can watch right now. Paid subscriptions are coming soon.",
  },
};

export default function PrivateStreamGate({
  username,
  privacy,
  reason: _reason,
  avatar,
}: PrivateStreamGateProps) {
  const copy = COPY[privacy] ?? COPY.unlisted;

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center shadow-sm">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full overflow-hidden bg-muted flex items-center justify-center">
            {avatar ? (
              <Image
                src={avatar}
                alt={username}
                width={64}
                height={64}
                className="w-full h-full object-cover"
              />
            ) : (
              <Lock className="w-7 h-7 text-muted-foreground" />
            )}
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 mb-2">
          <Lock className="w-4 h-4 text-muted-foreground" />
          <h1 className="text-xl font-semibold text-foreground">
            {copy.title}
          </h1>
        </div>

        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          {copy.body}
        </p>

        <div className="flex flex-col gap-2">
          <Link
            href={`/${username}`}
            className="px-4 py-2.5 bg-highlight hover:bg-highlight/90 text-primary-foreground rounded-lg text-sm font-medium transition-colors"
          >
            View {username}&rsquo;s profile
          </Link>
          <Link
            href="/explore"
            className="px-4 py-2.5 bg-transparent border border-border hover:bg-accent text-foreground rounded-lg text-sm font-medium transition-colors"
          >
            Browse other streams
          </Link>
        </div>
      </div>
    </div>
  );
}
