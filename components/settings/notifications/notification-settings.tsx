"use client";

import type React from "react";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  bgClasses,
  textClasses,
  borderClasses,
  buttonClasses,
  componentClasses,
  combineClasses,
} from "@/lib/theme-classes";

interface NotificationOptionType {
  title: string;
  description: string;
  enabled: boolean;
}

interface ToggleSwitchProps {
  enabled: boolean;
  onChange: (e: React.MouseEvent) => void;
}

interface NotificationCategoryProps {
  title: string;
  description: string;
  isOpen: boolean;
  toggleSection: () => void;
  options: NotificationOptionType[];
  onOptionToggle: (index: number) => void;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ enabled, onChange }) => {
  return (
    <div
      className={`flex-shrink-0 w-12 h-6 rounded-full p-1 transition-colors cursor-pointer ${enabled ? "bg-purple-600" : "bg-gray-700 dark:bg-gray-700"}`}
      onClick={onChange}
    >
      <div
        className={`bg-white w-4 h-4 rounded-full transform transition-transform ${enabled ? "translate-x-6" : "translate-x-0"}`}
      />
    </div>
  );
};

const NotificationCategory: React.FC<NotificationCategoryProps> = ({
  title,
  description,
  isOpen,
  toggleSection,
  options,
  onOptionToggle,
}) => {
  return (
    <div
      className={combineClasses(componentClasses.card, "mb-4 overflow-hidden")}
    >
      <div
        className="flex justify-between items-center cursor-pointer p-6"
        onClick={toggleSection}
      >
        <div className="flex-1">
          <h2
            className={combineClasses(
              textClasses.highlight,
              "text-xl font-medium",
            )}
          >
            {title}
          </h2>
          <p className={combineClasses(textClasses.tertiary, "text-sm")}>
            {description}
          </p>
        </div>
        <button className={textClasses.primary}>
          {isOpen ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
        </button>
      </div>

      {isOpen && (
        <div>
          <hr
            className={combineClasses(
              borderClasses.primary,
              "m-0 w-[96%] mx-auto",
            )}
          />
          <div>
            {options.map((option, index) => (
              <div
                key={index}
                className="py-5 flex justify-between items-center px-6 pl-24 md:pl-20"
              >
                <div className="flex-1 pr-4">
                  <h3 className={textClasses.primary}>{option.title}</h3>
                  <p
                    className={combineClasses(
                      textClasses.tertiary,
                      "text-sm italic font-light",
                    )}
                  >
                    {option.description}
                  </p>
                </div>
                <ToggleSwitch
                  enabled={option.enabled}
                  onChange={(e) => {
                    e.stopPropagation();
                    onOptionToggle(index);
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const NotificationSettings: React.FC = () => {
  const categories = [
    {
      id: "email",
      title: "Email Notifications",
      description: "Manage notifications sent to your registered email address",
      options: [
        {
          title: "Transaction Alerts",
          description:
            "Receive emails when transactions are completed or require attention",
          enabled: true,
        },
        {
          title: "Security Alerts",
          description:
            "Get notified about login attempts and security-related events",
          enabled: true,
        },
        {
          title: "Platform Updates",
          description:
            "Stay informed about new features and platform improvements",
          enabled: true,
        },
        {
          title: "Creator Updates",
          description: "Get notified when creators you follow post new content",
          enabled: true,
        },
      ],
    },
    {
      id: "push",
      title: "Push Notifications",
      description: "Control notifications sent to your devices",
      options: [
        {
          title: "Transaction Notifications",
          description: "Receive push alerts for transaction updates",
          enabled: false,
        },
        {
          title: "Security Notifications",
          description: "Be alerted about security events on your devices",
          enabled: true,
        },
        {
          title: "New Content Alerts",
          description: "Get notified when new content is available",
          enabled: false,
        },
      ],
    },
    {
      id: "inApp",
      title: "In-app Notifications",
      description: "Manage alerts that appear within the platform interface",
      options: [
        {
          title: "Activity Feed",
          description: "Show notifications in your activity feed",
          enabled: true,
        },
        {
          title: "Popup Alerts",
          description:
            "Display important alerts as popups within the interface",
          enabled: false,
        },
        {
          title: "Sound Notifications",
          description: "Play sounds for critical notifications",
          enabled: false,
        },
      ],
    },
  ];

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    email: false,
    push: false,
    inApp: false,
  });

  const [notificationOptions, setNotificationOptions] = useState(categories);

  const toggleSection = (sectionId: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const toggleOption = (categoryIndex: number, optionIndex: number) => {
    setNotificationOptions((prev) => {
      const newOptions = [...prev];
      newOptions[categoryIndex].options[optionIndex].enabled =
        !newOptions[categoryIndex].options[optionIndex].enabled;
      return newOptions;
    });
  };

  const saveChanges = () => {
    console.log("Saving changes...");
    console.log("Notification options:", notificationOptions);
    alert("Settings saved successfully!");
  };

  return (
    <div
      className={combineClasses(
        bgClasses.secondary,
        textClasses.primary,
        "min-h-screen",
      )}
    >
      <div className="max-w-8xl mx-auto">
        {notificationOptions.map((category, categoryIndex) => (
          <NotificationCategory
            key={category.id}
            title={category.title}
            description={category.description}
            isOpen={openSections[category.id]}
            toggleSection={() => toggleSection(category.id)}
            options={category.options}
            onOptionToggle={(optionIndex) =>
              toggleOption(categoryIndex, optionIndex)
            }
          />
        ))}

        <div className="flex justify-end">
          <button
            className={combineClasses(
              buttonClasses.secondary,
              "px-6 py-3 rounded-md",
            )}
            onClick={saveChanges}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationSettings;
