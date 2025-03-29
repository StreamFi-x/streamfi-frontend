"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { tabs } from "@/data/settings";

const SettingsHeader = () => {
  const pathname = usePathname();

  const getActiveTab = () => {
    if (pathname === "/settings/profile") return "Profile";
    if (pathname === "/settings/account") return "Account";
    if (pathname === "/settings/privacy") return "Privacy and Security";
    if (pathname === "/settings/notifications") return "Notification";
    return "Profile";
  };

  const activeTab = getActiveTab();

  return (
    <div>
      <h1 className="text-4xl font-bold mb-8">Settings</h1>
      <div className="w-full overflow-x-auto scrollbar-hide">
        <nav className="flex min-w-max space-x-6 md:space-x-8 px-4 sm:px-0">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.route}
              className={`group pb-4 px-1 whitespace-nowrap relative transition-colors ${
                activeTab === tab.id
                  ? "text-purple-500 font-medium"
                  : "text-white hover:text-purple-500"
              }`}
            >
              {tab.id}
              <span
                className={`absolute bottom-0 left-0 w-full h-0.5 bg-purple-500 transition-transform duration-300 ${
                  activeTab === tab.id
                    ? "scale-x-100"
                    : "scale-x-0 group-hover:scale-x-100"
                }`}
              ></span>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
};

export default SettingsHeader;
