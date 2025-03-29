"use client";
import React, { useState } from "react";
import { useToast } from "@/components/ui/toast-provider";
import {
  Lock,
  Link,
  Activity,
  Download,
  Shield,
  Eye,
  Bell,
  UserX,
} from "lucide-react";

interface PrivacyOption {
  id: string;
  label: string;
  enabled: boolean;
}

export default function PrivacySecurityContent() {
  const { showToast } = useToast();
  const [options, setOptions] = useState<PrivacyOption[]>([
    { id: "private_account", label: "Private Account", enabled: false },
    { id: "activity_status", label: "Show Activity Status", enabled: true },
    { id: "read_receipts", label: "Show Read Receipts", enabled: true },
    { id: "login_alerts", label: "Login Security Alerts", enabled: true },
    {
      id: "data_sharing",
      label: "Data Sharing with Third Parties",
      enabled: false,
    },
    {
      id: "content_visibility",
      label: "Content Visibility to Non-Followers",
      enabled: true,
    },
  ]);

  const handleToggle = (id: string) => {
    setOptions(
      options.map((option) =>
        option.id === id ? { ...option, enabled: !option.enabled } : option
      )
    );

    // Find the toggled option to show appropriate toast
    const option = options.find((opt) => opt.id === id);
    if (option) {
      const newState = !option.enabled;
      const message = `${option.label} ${newState ? "enabled" : "disabled"}`;
      showToast(message, "success");
    }
  };

  const handleSaveChanges = () => {
    console.log("Saving privacy settings:", options);
    showToast("Privacy settings saved successfully", "success");
  };

  return (
    <div className="min-h-screen bg-black">
      <div className="2xl:max-w-4xl mx-auto lg:p-4">
        <div className="bg-[#1a1a1a] rounded-lg p-6 mb-6">
          {options.map((option) => (
            <div
              key={option.id}
              className="flex items-center justify-between py-3 border-b border-gray-800 last:border-b-0"
            >
              <span className="text-white text-base md:text-lg">
                {option.label}
              </span>
              <button
                onClick={() => handleToggle(option.id)}
                className="relative inline-flex items-center h-6 rounded-full w-11 bg-black transition-colors focus:outline-none"
                aria-pressed={option.enabled}
              >
                <span
                  className={`inline-block w-4 h-4 transform rounded-full transition-transform ${
                    option.enabled
                      ? "bg-[#9147FF] translate-x-6"
                      : "bg-white translate-x-1"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>

        <div className="bg-[#1a1a1a] rounded-lg p-6 mb-6">
          <h2 className="text-white text-xl font-semibold mb-4">
            Account Security
          </h2>
          <div className="space-y-4">
            <button className="w-full text-left bg-[#2a2a2a] hover:bg-[#333333] text-white p-4 rounded-md transition flex items-center">
              <Lock className="h-5 w-5 mr-3 text-purple-400" />
              Change Password
            </button>
            <button className="w-full text-left bg-[#2a2a2a] hover:bg-[#333333] text-white p-4 rounded-md transition flex items-center">
              <Link className="h-5 w-5 mr-3 text-blue-400" />
              Manage Connected Accounts
            </button>
            <button className="w-full text-left bg-[#2a2a2a] hover:bg-[#333333] text-white p-4 rounded-md transition flex items-center">
              <Activity className="h-5 w-5 mr-3 text-green-400" />
              View Account Activity
            </button>
            <button className="w-full text-left bg-[#2a2a2a] hover:bg-[#333333] text-white p-4 rounded-md transition flex items-center">
              <Download className="h-5 w-5 mr-3 text-yellow-400" />
              Download Your Data
            </button>
            <button className="w-full text-left bg-[#2a2a2a] hover:bg-[#333333] text-white p-4 rounded-md transition flex items-center">
              <Shield className="h-5 w-5 mr-3 text-red-400" />
              Security Checkup
            </button>
            <button className="w-full text-left bg-[#2a2a2a] hover:bg-[#333333] text-white p-4 rounded-md transition flex items-center">
              <Eye className="h-5 w-5 mr-3 text-cyan-400" />
              Privacy Checkup
            </button>
            <button className="w-full text-left bg-[#2a2a2a] hover:bg-[#333333] text-white p-4 rounded-md transition flex items-center">
              <Bell className="h-5 w-5 mr-3 text-orange-400" />
              Notification Preferences
            </button>
            <button className="w-full text-left bg-[#2a2a2a] hover:bg-[#333333] text-white p-4 rounded-md transition flex items-center">
              <UserX className="h-5 w-5 mr-3 text-pink-400" />
              Blocked Accounts
            </button>
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
}
