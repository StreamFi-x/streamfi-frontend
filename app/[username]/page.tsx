import React from "react";
import Image from "next/image";

const streams = new Array(4).fill({
  title: "Clash of clans Live play",
  tagList: ["Nigerian", "Gameplay", "Gaming"],
  viewers: "14.5K",
  thumbnail: "/images/sample-stream.jpg",
  streamer: "Flaggames",
});

const clips = [...streams];

export default function HomeTab() {
  return (
    <div className="space-y-10">
      {/* Recent Streams */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Recent Streams</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {streams.map((stream, idx) => (
            <div
              key={idx}
              className="bg-muted rounded-lg overflow-hidden shadow-md"
            >
              <div className="relative h-40">
                <Image
                  src={stream.thumbnail}
                  alt="Stream thumbnail"
                  fill
                  className="object-cover"
                />
                <span className="absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-0.5 rounded">
                  Live
                </span>
                <span className="absolute top-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-0.5 rounded">
                  {stream.viewers}
                </span>
              </div>
              <div className="p-3">
                <p className="text-sm text-gray-300 mb-1">{stream.streamer}</p>
                <h3 className="font-semibold text-white text-sm">
                  {stream.title}
                </h3>
                <div className="flex flex-wrap gap-1 mt-2">
                  {stream.tagList.map((tag: string[], i: number) => (
                    <span
                      key={i}
                      className="text-[10px] px-2 py-0.5 bg-zinc-700 text-white rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Popular Clips */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Popular Clips</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {clips.map((clip, idx) => (
            <div
              key={idx}
              className="bg-muted rounded-lg overflow-hidden shadow-md"
            >
              <div className="relative h-40">
                <Image
                  src={clip.thumbnail}
                  alt="Clip thumbnail"
                  fill
                  className="object-cover"
                />
                <span className="absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-0.5 rounded">
                  Live
                </span>
                <span className="absolute top-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-0.5 rounded">
                  {clip.viewers}
                </span>
              </div>
              <div className="p-3">
                <p className="text-sm text-gray-300 mb-1">{clip.streamer}</p>
                <h3 className="font-semibold text-white text-sm">
                  {clip.title}
                </h3>
                <div className="flex flex-wrap gap-1 mt-2">
                  {clip.tagList.map((tag: string, i: number) => (
                    <span
                      key={i}
                      className="text-[10px] px-2 py-0.5 bg-zinc-700 text-white rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
