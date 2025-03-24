'use client'
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const SettingsHeader = () => {
  const pathname = usePathname();
  
  
  const tabs = [
    { id: 'Profile', route: '/explore/settings/profile' },
    { id: 'Account', route: '/explore/settings/account' },
    { id: 'Privacy and Security', route: '/explore/settings/privacy' },
    { id: 'Notification', route: '/explore/settings/notifications' }
  ];
  
  
  const getActiveTab = () => {
    if (pathname === '/explore/settings/profile') return 'Profile';
    if (pathname === '/explore/settings/account') return 'Account';
    if (pathname === '/explore/settings/privacy') return 'Privacy and Security';
    if (pathname === '/explore/settings/notifications') return 'Notification';
    return 'Profile'; 
  };
  
  const activeTab = getActiveTab();
  
  return (
    <div className="">
      <h1 className="text-4xl font-bold mb-8">Settings</h1>
      <div className="overflow-x-auto">
        <nav className="flex space-x-6 md:space-x-8">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.route}
              className={`group pb-4 px-1 whitespace-nowrap relative transition-colors ${
                activeTab === tab.id
                ? 'text-purple-500 font-medium'
                : 'text-white hover:text-purple-500'
              }`}
            >
              {tab.id}
              <span
                className={`absolute bottom-0 left-0 w-full h-0.5 bg-purple-500 transition-transform duration-300 ${
                  activeTab === tab.id
                  ? 'scale-x-100'
                  : 'scale-x-0 group-hover:scale-x-100'
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