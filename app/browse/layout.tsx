"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/explore/Navbar";
import Sidebar from "@/components/explore/Sidebar";

export default function BrowseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  useEffect(() => {
    if (pathname === "/browse") {
      router.replace("/browse/live");
    }
  }, [pathname, router]);

  const tabs = [
    {
      name: "Live channels",
      href: "/browse/live",
      active: pathname === "/browse/live",
    },
    {
      name: "Categories",
      href: "/browse/category",
      active: pathname === "/browse/category",
    },
  ];

  const primaryTags = [
    "Games",
    "IRL",
    "Shooter",
    "FPS",
    "Creative",
    "Esports",
    "Arcade",
    "Racing",
    "God of war",
    "NBA",
    "Football",
  ];

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  return (
    <main className="bg-[#1a1a1a]">
      <div className="flex flex-col h-screen">
        {/* <Navbar /> */}
        <div className="flex h-screen overflow-hidden">
          {/* <Sidebar /> */}
          <main className="flex-1 overflow-y-auto scrollbar-hide">
            <div className="max-w-full mx-auto px-4 py-8 bg-[#111111]">
              <div className="mb-12">
                <h1 className="text-4xl font-bold text-white mb-2">Browse</h1>
              </div>

              {/* Primary Tag Filters - FIRST (directly under Browse title) */}
              <div className="mb-8 space-y-4">
                <div className="flex flex-wrap gap-3">
                  {primaryTags.map(tag => (
                    <Button
                      key={tag}
                      variant={
                        selectedTags.includes(tag) ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => toggleTag(tag)}
                      className={cn(
                        "transition-colors text-[14px] px-8 py-6 rounded-md",
                        selectedTags.includes(tag)
                          ? "bg-purple-600 hover:bg-purple-700 text-white"
                          : "bg-[#222222] text-white"
                      )}
                    >
                      {tag}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Tabs Navigation - SECOND (after tag filters) */}
              <div className="mb-8">
                <nav className="flex space-x-8 border-b border-gray-700">
                  {tabs.map(tab => (
                    <Link
                      key={tab.name}
                      href={tab.href}
                      className={cn(
                        "pb-4 px-1 text-sm font-medium transition-colors",
                        tab.active
                          ? "text-white border-b-2 border-purple-500"
                          : "text-gray-400 hover:text-white"
                      )}
                    >
                      {tab.name}
                    </Link>
                  ))}
                </nav>
              </div>

              {children}
            </div>
          </main>
        </div>
      </div>
    </main>
  );
}
