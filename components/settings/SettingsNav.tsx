'use client';

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { tabs } from "@/data/settings";

const SettingsHeader = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("");

  // Update the active tab when the pathname changes
  useEffect(() => {
    // Determine which tab should be active based on the current path
    if (pathname.includes('/settings/profile')) {
      setActiveTab('Profile');
    } else if (pathname.includes('/settings/privacy')) {
      setActiveTab('Privacy & Security');
    } else if (pathname.includes('/settings/notifications')) {
      setActiveTab('Notifications');
    } else if (pathname.includes('/settings/stream-Preference')) {
      setActiveTab('Stream & Channel Preferences');
    } else if (pathname.includes('/settings/appearance')) {
      setActiveTab('Appearance');
    } else if (pathname.includes('/settings/connected-accounts')) {
      setActiveTab('Connected Accounts');
    } else {
      setActiveTab('Profile'); // Default
    }
  }, [pathname]);

  // Handle tab click
  const handleTabClick = (tabId: string, tabRoute: string) => {
    setActiveTab(tabId);
    router.push(tabRoute);
  };

  return (
    <div>
      <h1 className="text-4xl font-bold mb-8">Settings</h1>
      <div className="w-full overflow-x-auto scrollbar-hide">
        <nav className="flex min-w-max space-x-6 md:space-x-8 px-4 sm:px-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id, tab.route)}
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
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
};

export default SettingsHeader;