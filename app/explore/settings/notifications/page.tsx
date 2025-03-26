'use client'
import React, { useState } from 'react';
import { ToastProvider, useToast } from '@/components/ui/toast-provider';
import {
  notificationSettings
} from "@/data/explore/sidebar";

// Define the NotificationSetting type if it doesn't exist
type NotificationSetting = {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  icon: React.FC<{ size: number }>; // Adjust based on your icon component
};

const NotificationsContent: React.FC = () => {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<NotificationSetting[]>(notificationSettings);

  const handleToggle = (id: string) => {
    setSettings(settings.map(setting =>
      setting.id === id ? { ...setting, enabled: !setting.enabled } : setting
    ));
    
    // Find the toggled setting to show appropriate toast
    const setting = settings.find(s => s.id === id);
    if (setting) {
      const newState = !setting.enabled;
      const message = `${setting.label} ${newState ? 'enabled' : 'disabled'}`;
      showToast(message, 'success');
    }
  };

  const handleSaveChanges = () => {
    console.log('Saving notification settings:', settings);
    showToast('Notification settings saved successfully', 'success');
  };

  return (
    <div className="min-h-screen bg-black">
      <div className="2xl:max-w-4xl mx-auto lg:p-4">
        <div className="bg-[#1a1a1a] rounded-lg p-6 mb-6">
          <h2 className="text-white text-xl font-semibold mb-4">Notification Preferences</h2>
          
          {settings.map(item => (
            <div key={item.id} className="flex items-center justify-between py-4 border-b border-gray-800 last:border-b-0">
              <div className="flex items-start">
                <div className="mr-3 mt-1">{<item.icon size={20}/>}</div>
                <div>
                  <h3 className="text-white text-base md:text-lg">{item.label}</h3>
                  <p className="text-gray-400 text-sm">{item.description}</p>
                </div>
              </div>
              <button
                onClick={() => handleToggle(item.id)}
                className="relative inline-flex items-center h-6 rounded-full w-11 bg-black transition-colors focus:outline-none"
                aria-pressed={item.enabled}
              >
                <span
                  className={`inline-block w-4 h-4 transform rounded-full transition-transform ${
                    item.enabled ? 'bg-[#9147FF] translate-x-6' : 'bg-white translate-x-1'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
        
        <div className="bg-[#1a1a1a] rounded-lg p-6 mb-6">
          <h2 className="text-white text-xl font-semibold mb-4">Notification Schedule</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <span className="text-white">Quiet Hours</span>
              <div className="flex space-x-2">
                <select className="bg-[#2a2a2a] text-white p-2 rounded-md">
                  {Array.from({ length: 24 }).map((_, i) => (
                    <option key={`start-${i}`} value={i}>
                      {i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}
                    </option>
                  ))}
                </select>
                <span className="text-white self-center">to</span>
                <select className="bg-[#2a2a2a] text-white p-2 rounded-md">
                  {Array.from({ length: 24 }).map((_, i) => (
                    <option key={`end-${i}`} value={i}>
                      {i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="flex items-center justify-between py-2">
              <span className="text-white">Do Not Disturb</span>
              <button
                className="relative inline-flex items-center h-6 rounded-full w-11 bg-black transition-colors focus:outline-none"
                aria-pressed="false"
              >
                <span className="inline-block w-4 h-4 transform rounded-full transition-transform bg-white translate-x-1" />
              </button>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end">
          <button
            onClick={handleSaveChanges}
            className="bg-[#5A189A] hover:bg-opacity-90 text-white px-6 py-3 rounded-md transition"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

const NotificationsSettings: React.FC = () => {
  return (
    <ToastProvider>
      <NotificationsContent />
    </ToastProvider>
  );
};

export default NotificationsSettings;