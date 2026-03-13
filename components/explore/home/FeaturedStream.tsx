"use client";

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  type MouseEvent,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  Eye,
  Radio,
} from "lucide-react";
import MuxPlayer from "@/components/MuxPlayerLazy";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { FeaturedStreamProps, CarouselStream } from "@/types/explore/home";

function getMuxThumbnail(playbackId: string): string {
  return `https://image.mux.com/${playbackId}/thumbnail.png?width=1280&height=720&fit_mode=crop`;
}

function streamThumbnail(stream: CarouselStream): string {
  if (stream.playbackId) return getMuxThumbnail(stream.playbackId);
  return stream.thumbnail;
}

function StreamerAvatar({ src, name }: { src: string; name: string }) {
  if (src.includes("cloudinary.com")) {
    return (
      <img
        src={src}
        alt={name}
        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
      />
    );
  }
  return (
    <Image
      src={src || "/Images/user.png"}
      alt={name}
      width={32}
      height={32}
      className="w-8 h-8 rounded-full object-cover flex-shrink-0"
    />
  );
}

function PreviewCard({
  stream,
  onClick,
  side,
}: {
  stream: CarouselStream;
  onClick: () => void;
  side: "left" | "right";
}) {
  const thumb = streamThumbnail(stream);
  return (
    <button
      onClick={onClick}
      aria-label={`Switch to ${stream.title}`}
      className={`hidden lg:block relative flex-shrink-0 w-[13%] rounded-xl overflow-hidden cursor-pointer
        opacity-50 hover:opacity-75 transition-all duration-300 hover:scale-[1.02]
        ${side === "left" ? "origin-right" : "origin-left"}`}
    >
      {thumb.includes("cloudinary.com") || thumb.includes("mux.com") ? (
        <img src={thumb} alt={stream.title} className="w-full h-full object-cover" />
      ) : (
        <Image
          src={thumb}
          alt={stream.title}
          fill
          className="object-cover"
          sizes="13vw"
        />
      )}
      <div className="absolute inset-0 bg-black/40" />
      {/* Fade toward centre */}
      <div
        className={`absolute inset-0 bg-gradient-to-${side === "left" ? "l" : "r"} from-transparent to-secondary/80`}
      />
    </button>
  );
}

export function FeaturedStream({ streams }: FeaturedStreamProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);

  // autoPlay="muted" forces muted regardless of the muted prop (browser policy).
  // Once the video starts playing, unmute it programmatically.
  useEffect(() => {
    const el = playerRef.current;
    if (!el) return;
    const unmute = () => {
      if (!isMuted) el.muted = false;
    };
    el.addEventListener("playing", unmute, { once: true });
    return () => el.removeEventListener("playing", unmute);
  }, [activeIndex, isMuted]);

  const goTo = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  const goPrev = useCallback(
    (e?: MouseEvent) => {
      e?.stopPropagation();
      goTo((activeIndex - 1 + streams.length) % streams.length);
    },
    [activeIndex, streams.length, goTo]
  );

  const goNext = useCallback(
    (e?: MouseEvent) => {
      e?.stopPropagation();
      goTo((activeIndex + 1) % streams.length);
    },
    [activeIndex, streams.length, goTo]
  );

  // Empty state — no live streams and no past recordings yet
  if (!streams.length) {
    return (
      <div className="relative w-full aspect-video xl:aspect-[20/8.5] rounded-xl overflow-hidden border border-dashed border-border bg-card/40 flex flex-col items-center justify-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
          <Radio className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="text-foreground font-medium">Nothing live right now</p>
        <p className="text-sm text-muted-foreground">
          Check back soon — streams and recordings will appear here.
        </p>
      </div>
    );
  }

  const active = streams[activeIndex];
  const prevIndex = (activeIndex - 1 + streams.length) % streams.length;
  const nextIndex = (activeIndex + 1) % streams.length;
  const thumb = streamThumbnail(active);

  const handleStreamerClick = (e: MouseEvent) => {
    e.stopPropagation();
    router.push(
      `/${active.streamer.username.toLowerCase().replace(/\s+/g, "")}`
    );
  };

  return (
    <div className="relative w-full mb-8">
      <div className="flex items-stretch gap-2 h-[220px] sm:h-[300px] lg:h-[400px] xl:h-[460px]">
        {/* Left peek */}
        {streams.length > 1 && (
          <PreviewCard stream={streams[prevIndex]} onClick={goPrev} side="left" />
        )}

        {/* ── Featured (centre) ── */}
        <div className="relative flex-1 rounded-xl overflow-hidden border border-highlight">
          {/* Video — auto-plays live streams and VOD recordings */}
          {active.playbackId ? (
            <MuxPlayer
              ref={playerRef}
              key={`${active.id}-${activeIndex}`}
              playbackId={active.playbackId}
              streamType={active.isLive ? "ll-live" : "on-demand"}
              autoPlay="muted"
              muted={isMuted}
              primaryColor="#ac39f2"
              className="w-full h-full"
              style={{ aspectRatio: "unset", height: "100%" }}
            />
          ) : (
            <div className="absolute inset-0">
              {thumb.includes("cloudinary.com") || thumb.includes("mux.com") ? (
                <img
                  src={thumb}
                  alt={active.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Image
                  src={thumb}
                  alt={active.title}
                  fill
                  className="object-cover"
                  sizes="100vw"
                  priority
                />
              )}
            </div>
          )}

          {/* Bottom gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent pointer-events-none" />

          {/* Top bar: streamer info + LIVE/VOD badge + mute */}
          <div className="absolute top-0 left-0 right-0 px-3 pt-3 pb-6 bg-gradient-to-b from-black/70 to-transparent z-10 pointer-events-none">
            <div className="flex items-center gap-2">
              {/* LIVE / VOD badge */}
              {active.isLive ? (
                <span className="bg-red-600 text-white text-xs px-2 py-1 rounded font-bold tracking-wide flex-shrink-0 pointer-events-auto">
                  LIVE
                </span>
              ) : (
                <span className="bg-black/60 text-white/80 text-xs px-2 py-1 rounded font-semibold tracking-wide border border-white/10 flex-shrink-0 pointer-events-auto">
                  VOD
                </span>
              )}

              {/* Streamer avatar + name + location */}
              <div className="pointer-events-auto">
                <StreamerAvatar src={active.streamer.logo} name={active.streamer.name} />
              </div>
              <div className="flex-1 min-w-0 pointer-events-auto">
                <button
                  onClick={handleStreamerClick}
                  className="text-white font-semibold text-sm leading-none hover:underline truncate block text-left"
                >
                  {active.streamer.name}
                </button>
                {active.location && (
                  <p className="text-white/50 text-xs mt-0.5 truncate">
                    {active.location}
                  </p>
                )}
              </div>

              {/* View count */}
              <div className="flex items-center gap-1 text-white/70 text-xs flex-shrink-0 pointer-events-auto">
                <Eye className="w-3 h-3" />
                {active.viewCount}
              </div>

              {/* Mute toggle */}
              {active.playbackId && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    setIsMuted(m => !m);
                  }}
                  className="bg-black/50 hover:bg-black/75 text-white p-2 rounded-full transition-colors pointer-events-auto flex-shrink-0"
                  aria-label={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Bottom stream info: title + tags */}
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-14 pt-8 z-10 pointer-events-none">
            <h2 className="text-white font-bold text-sm sm:text-base lg:text-lg line-clamp-1">
              {active.title}
            </h2>

            {active.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {active.tags.slice(0, 4).map(tag => (
                  <span
                    key={tag}
                    className="text-[11px] bg-white/10 text-white/70 px-2 py-0.5 rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Nav arrows */}
          {streams.length > 1 && (
            <>
              <button
                onClick={goPrev}
                className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/70 text-white p-2 rounded-full transition-all z-10"
                aria-label="Previous stream"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={goNext}
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/70 text-white p-2 rounded-full transition-all z-10"
                aria-label="Next stream"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          {/* Progress dots */}
          {streams.length > 1 && (
            <div className="absolute bottom-4 right-4 flex items-center gap-1 z-10">
              {streams.map((_, i) => (
                <button
                  key={i}
                  onClick={e => {
                    e.stopPropagation();
                    goTo(i);
                  }}
                  aria-label={`Go to stream ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === activeIndex
                      ? "w-4 bg-white"
                      : "w-1.5 bg-white/40 hover:bg-white/60"
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right peek — only when 3+ streams so prev ≠ next */}
        {streams.length > 2 && (
          <PreviewCard stream={streams[nextIndex]} onClick={goNext} side="right" />
        )}
      </div>
    </div>
  );
}
