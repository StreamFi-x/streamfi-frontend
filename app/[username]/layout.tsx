// app/profile/[username]/layout.tsx
import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const tabs = [
  { name: "Home", href: "" },
  { name: "About", href: "about" },
  { name: "Videos", href: "videos" },
  { name: "Clips", href: "clips" },
  { name: "Watch", href: "watch" },
];

export default function ProfileLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { username: string };
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="text-xl font-bold">
            {params.username}&apos;s Channel
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 flex gap-6 border-t border-white/10 pt-4">
          {tabs.map((tab) => {
            const isActive =
              pathname.endsWith(`/${tab.href}`) ||
              (tab.href === "" && pathname.endsWith(params.username));
            return (
              <Link
                key={tab.name}
                href={`/profile/${params.username}/${tab.href}`}
                className={clsx(
                  "pb-2 border-b-2 text-sm",
                  isActive
                    ? "border-white text-white"
                    : "border-transparent text-gray-400 hover:text-white"
                )}
              >
                {tab.name}
              </Link>
            );
          })}
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 py-6">{children}</div>
    </div>
  );
}
