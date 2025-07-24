"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import Navbar from "@/components/explore/Navbar";
import Sidebar from "@/components/explore/Sidebar";

export default function BrowseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  // Redirect /browse to /browse/live
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
      href: "/browse/categories",
      active: pathname === "/browse/categories",
    },
  ];

  return (
    <main className="bg-[#111111]">
      <div className="flex flex-col h-screen">
        <Navbar />

        <div className="flex h-screen overflow-hidden">
          <Sidebar />

          <main className="flex-1 overflow-y-auto scrollbar-hide">
            <div className="max-w-7xl mx-auto px-8 py-8">
              {/* Page Header */}
              <div className="mb-12">
                <h1 className="text-4xl font-bold text-white mb-2">Browse</h1>
              </div>

              {/* Tabs Navigation */}
              <div className="mb-8">
                <nav className="flex space-x-8 border-b border-gray-700">
                  {tabs.map((tab) => (
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

              {/* Page Content */}
              {children}
            </div>
          </main>
        </div>
      </div>
    </main>
  );
} 