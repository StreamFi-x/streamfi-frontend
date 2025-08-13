"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { bgClasses, textClasses } from "@/lib/theme-classes";

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
    <main className={` ${bgClasses.primary} ${textClasses.primary}`}>
      <div className="flex flex-col h-screen">
        {/* <Navbar /> */}
        <div className="flex h-screen overflow-hidden">
          {/* <Sidebar /> */}
          <main className="flex-1 overflow-y-auto scrollbar-hide">
            <div className="max-w-full mx-auto px-4 py-5 sm:py-8">
              <div className="mb-4">
                <h1
                  className={`${textClasses.primary} text-3xl sm:text-4xl font-bold text- mb-2"`}
                >
                  Browse
                </h1>
              </div>

              {/* Primary Tag Filters - FIRST (directly under Browse title) */}
              <div className="mb-4 space-y-4 overflow-hidden">
                <div className="flex flex- gap-3 overflow-x-auto scrollbar-hide">
                  {primaryTags.map(tag => (
                    <Button
                      key={tag}
                      variant={
                        selectedTags.includes(tag) ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => toggleTag(tag)}
                      className={cn(
                        "transition-colors text-[10px] sm:text-sm px-2 !border-none sm:px-4 py-0.5  sm:py-2 rounded-md",
                        selectedTags.includes(tag)
                          ? "bg-purple-600 hover:bg-purple-700 "
                          : `${bgClasses.tag} hover:text-white`
                      )}
                    >
                      {tag}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Tabs Navigation - SECOND (after tag filters) */}
              <div className="mb-4">
                <nav className="flex space-x-4 border-b border-gray-700">
                  {tabs.map(tab => (
                    <Link
                      key={tab.name}
                      href={tab.href}
                      className={cn(
                        "pb-2 px-1 text-xs sm:text-sm font-medium transition-colors",
                        tab.active
                          ? ` ${textClasses.primary} !border-b-2 border-purple-500`
                          : `${textClasses.secondary} `
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
