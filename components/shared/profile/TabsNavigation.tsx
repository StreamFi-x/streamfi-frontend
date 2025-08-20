"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight } from "lucide-react";

interface TabsNavigationProps {
  username: string;
}

const TabsNavigation = ({ username }: TabsNavigationProps) => {
  const pathname = usePathname();

  const tabs = [
    { name: "Home", path: `/${username}` },
    { name: "About", path: `/${username}/about` },
    { name: "Videos", path: `/${username}/videos` },
    { name: "Clips", path: `/${username}/clips` },
    {
      name: "Watch",
      path: `/${username}/watch`,
      icon: <ArrowUpRight className="h-4 w-4 ml-1" />,
    },
  ];

  const isActive = (path: string) => {
    if (path === `/${username}`) {
      return pathname === `/${username}`;
    }
    return pathname === path;
  };

  return (
    <div className="border-b border-border">
      <nav className="flex px-4 sm:px-6">
        {tabs.map(tab => (
          <Link
            key={tab.name}
            href={tab.path}
            className={`flex items-center px-4 py-3 text-xs sm:text-sm font-medium transition-colors duration-300 relative ${
              isActive(tab.path)
                ? "text-foreground after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-highlight"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.name}
            {tab.icon}
          </Link>
        ))}
      </nav>
    </div>
  );
};

export default TabsNavigation;
