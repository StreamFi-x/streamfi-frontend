"use client";

import { useState, useEffect } from "react";
import { BrowseLiveSkeleton } from "@/components/skeletons/browseLiveSkeleton";

export default function BrowseLivePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [liveStreams, setLiveStreams] = useState([]);

  useEffect(() => {
    const fetchLiveStreams = async () => {
      try {
        // Simulate API call - replace with actual API endpoint
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Replace this with actual API call
        // const response = await fetch('/api/live-streams')
        // const data = await response.json()
        // setLiveStreams(data)

        setLiveStreams([]); // Set actual data here when API is ready
      } catch (error) {
        console.error("Error fetching live streams:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLiveStreams();
  }, []);

  if (isLoading) {
    return (
      <div className="max-w-full mx-auto px-4 py-8 bg-[#111111]">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-2">Browse</h1>
        </div>
        <BrowseLiveSkeleton count={6} />
      </div>
    );
  }

  // This is what shows when loading is complete
  return (
    <div className="max-w-full mx-auto px-4 py-8 bg-[#111111]">
      <div className="mb-12">
        <h1 className="text-4xl font-bold text-white mb-2">Browse</h1>
      </div>

      {/* Tags section */}
      <div className="flex flex-wrap gap-3 mb-6">
        <span className="bg-gray-800 text-white px-4 py-2 rounded-md">
          Gaming
        </span>
        <span className="bg-gray-800 text-white px-4 py-2 rounded-md">
          Just Chatting
        </span>
        <span className="bg-gray-800 text-white px-4 py-2 rounded-md">
          Music
        </span>
        <span className="bg-gray-800 text-white px-4 py-2 rounded-md">
          Sports
        </span>
        <span className="bg-gray-800 text-white px-4 py-2 rounded-md">Art</span>
        <span className="bg-gray-800 text-white px-4 py-2 rounded-md">
          Food
        </span>
      </div>

      {/* Live/Categories switcher */}
      <div className="flex space-x-4 border-b border-gray-700 mb-6">
        <button className="text-white border-b-2 border-purple-500 pb-2">
          Live Channels
        </button>
        <button className="text-gray-400 pb-2">Categories</button>
      </div>

      {/* Search and sort section */}
      <div className="flex items-center justify-between gap-6 py-6">
        <div className="flex-1 max-w-md">
          <input
            type="search"
            placeholder="Search live channels..."
            className="w-full h-10 px-4 rounded-md bg-gray-800 text-white border border-gray-700 focus:border-purple-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-gray-400">Sort by:</span>
          <select className="bg-gray-800 text-white px-4 py-2 rounded-md border border-gray-700 focus:border-purple-500 focus:outline-none">
            <option>Recommended for you</option>
            <option>Viewer count (high to low)</option>
            <option>Viewer count (low to high)</option>
            <option>Recently started</option>
          </select>
        </div>
      </div>

      {/* Live streams content */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {liveStreams.length > 0 ? (
          // When we have actual data, map through liveStreams here
          liveStreams.map((stream, index) => (
            <div key={index} className="bg-gray-900 rounded-lg overflow-hidden">
              {/* actual stream card component will go here */}
              <div className="text-white p-4">Stream {index + 1}</div>
            </div>
          ))
        ) : (
          // Placeholder content when no streams are available
          <div className="col-span-full text-center py-12">
            <p className="text-gray-400 text-lg">
              No live streams available at the moment
            </p>
            <p className="text-gray-500 text-sm mt-2">
              Check back later for live content!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
