"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { tabs } from "@/data/settings";

// URL mapping for settings tabs
const URL_MAPPING = {
  Profile: "/settings/profile",
  "Privacy & Security": "/settings/privacy",
  Notifications: "/settings/notifications",
  "Stream & Channel Preferences": "/settings/stream-preference",
  Appearance: "/settings/appearance",
  "Connected Accounts": "/settings/connected-accounts",
};

export default function SettingsNavigation() {
  const pathname = usePathname();

  return (
    <div className="w-full overflow-x-auto scrollbar-hide">
      <nav className="flex min-w-max space-x-6 md:space-x-8 px-4 sm:px-0">
        {tabs.map(tab => {
          const tabUrl = URL_MAPPING[tab.id as keyof typeof URL_MAPPING];
          const isActive = pathname === tabUrl;

          return (
            <Link
              key={tab.id}
              href={tabUrl}
              className={`group pb-4 px-1 whitespace-nowrap relative transition-colors ${
                isActive
                  ? `text-highlight font-medium`
                  : `text-foreground hover:text-highlight`
              }`}
            >
              {tab.id}
              <span
                className={`absolute bottom-0 left-0 w-full h-0.5 bg-highlight  transition-transform duration-300 ${
                  isActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                }`}
              ></span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
