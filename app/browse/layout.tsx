"use client";
import React from "react";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BrowseLayoutSkeleton } from "@/components/skeletons/skeletons/browseLayoutSkeleton";

export default function BrowseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [layoutLoading, setLayoutLoading] = useState(true);

  // Check if we're on a category detail page
  const isCategoryDetailPage =
    pathname.startsWith("/browse/category/") && pathname !== "/browse/category";

  useEffect(() => {
    if (pathname === "/browse") {
      router.replace("/browse/live");
    }

    // Simulate layout loading
    const timer = setTimeout(() => {
      setLayoutLoading(false);
    }, 500);

    return () => clearTimeout(timer);
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
    <main className="bg-background text-foreground">
      <div className="flex flex-col h-screen">
        {/* <Navbar /> */}
        <div className="flex h-screen overflow-hidden">
          {/* <Sidebar /> */}
          <main className="flex-1 overflow-y-auto scrollbar-hide">
            <div className="max-w-full mx-auto px-4 py-5 sm:py-8">
              {!isCategoryDetailPage && (
                <>
                  {layoutLoading ? (
                    <BrowseLayoutSkeleton />
                  ) : (
                    <>
                      <div className="mb-4">
                        <h1
                          className={` text-3xl sm:text-4xl font-bold text- mb-2"`}
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
                                selectedTags.includes(tag)
                                  ? "default"
                                  : "outline"
                              }
                              size="sm"
                              onClick={() => toggleTag(tag)}
                              className={cn(
                                "transition-colors text-[10px]  sm:text-sm px-2 text-white dark:tex !border-none sm:px-4 py-0.5 bg-tag sm:py-2 rounded-md",
                                selectedTags.includes(tag)
                                  ? "bg-purple-600 hover:bg-purple-700 "
                                  : `hover:bg-tag hover:text-white`
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
                                "pb-2 px-1 text-xs sm:text-sm font-medium  transition-colors",
                                tab.active
                                  ? ` !border-b-2 border-purple-500`
                                  : ` `
                              )}
                            >
                              {tab.name}
                            </Link>
                          ))}
                        </nav>
                      </div>
                    </>
                  )}
                </>
              )}

              {children}
            </div>
          </main>
        </div>
      </div>
    </main>
  );
}
