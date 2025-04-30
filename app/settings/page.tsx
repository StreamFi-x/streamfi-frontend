'use client';
import React, { useState } from 'react';
import { ToastProvider } from '@/components/ui/toast-provider';
import { tabs } from "@/data/settings";
// Import all your settings components with the correct paths
import ProfileSettings from '@/components/settings/profile/profile-page';
import PrivacySettings from '@/components/settings/privacy-and-security/PrivacyAndSecurity';
import NotificationSettings from '@/components/settings/notifications/NotificationSettings';
import StreamPreferenceSettings from '@/components/settings/Stream & Channel Preferences/stream-preference';
import AppearanceSettings from '@/components/settings/appearance/appearance';
import ConnectedAccountsSettings from '@/components/settings/Connected Accounts/connected-account';

// Define a type for the valid tab names
type TabName = 'Profile' | 'Privacy & Security' | 'Notifications' | 'Stream & Channel Preferences' | 'Appearance' | 'Connected Accounts';

export default function SettingsPage() {
  // State to track the active tab with proper type annotation
  const [activeTab, setActiveTab] = useState<TabName>('Profile');

  // Component mapping - maps tab IDs to components
  const COMPONENT_MAPPING = {
    'Profile': <ProfileSettings />,
    'Privacy & Security': <PrivacySettings />,
    'Notifications': <NotificationSettings />,
    'Stream & Channel Preferences': <StreamPreferenceSettings />,
    'Appearance': <AppearanceSettings />,
    'Connected Accounts': <ConnectedAccountsSettings />
  };

  // Render the settings header with tabs
  const renderHeader = () => {
    return (
      <div>
        <h1 className="text-4xl font-bold mb-8">Settings</h1>
        <div className="w-full overflow-x-auto scrollbar-hide">
          <nav className="flex min-w-max space-x-6 md:space-x-8 px-4 sm:px-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabName)}
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

  return (
    <ToastProvider>
      {/* Render the header */}
      {renderHeader()}
      {/* Render the active component */}
      <div className="settings-content mt-8">
        {COMPONENT_MAPPING[activeTab] || <ProfileSettings />}
      </div>
    </ToastProvider>
  );
}