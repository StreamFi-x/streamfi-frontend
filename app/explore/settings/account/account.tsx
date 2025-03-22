'use client'
import React, { useState } from 'react';
interface NotificationOption {
  id: string;
  label: string;
  enabled: boolean;
}
const NotificationSettings: React.FC = () => {
  const [options, setOptions] = useState<NotificationOption[]>([
    { id: 'email', label: 'Email Notification', enabled: true },
    { id: '2fa', label: 'Two-Factor Authentication (2FA)', enabled: true }
  ]);
  const handleToggle = (id: string) => {
    setOptions(options.map(option =>
      option.id === id ? { ...option, enabled: !option.enabled } : option
    ));
  };
  const handleSaveChanges = () => {
    console.log('Saving notification settings:', options);
    

  };
  return (
    <div className="min-h-screen bg-black">
      <div className="2xl:max-w-4xl mx-auto lg:p-4">
        <div className="bg-[#1a1a1a] rounded-lg p-6 mb-6">
          {options.map(option => (
            <div key={option.id} className="flex items-center justify-between py-3  last:border-b-0">
              <span className="text-white text-base md:text-lg">{option.label}</span>
              <button
                onClick={() => handleToggle(option.id)}
                className="relative inline-flex items-center h-6 rounded-full w-11 bg-black transition-colors focus:outline-none"
                aria-pressed={option.enabled}
              >
                <span
                  className={`inline-block w-4 h-4 transform rounded-full transition-transform ${
                    option.enabled ? 'bg-[#9147FF] translate-x-6' : 'bg-white translate-x-1'
                  }`}
                />
              </button>
            </div>
          ))}
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
export default NotificationSettings;