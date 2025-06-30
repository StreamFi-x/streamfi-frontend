"use client";
import type React from "react";
import Image from "next/image";
import DiscordLogo from "@/public/Images/discord.svg";
import SteamLogo from "@/public/Images/steam.svg";
import YoutubeLogo from "@/public/Images/youtube.svg";
import {
  bgClasses,
  textClasses,
  borderClasses,
  buttonClasses,
  componentClasses,
  combineClasses,
} from "@/lib/theme-classes";

interface ConnectionItemProps {
  icon: string;
  name: string;
  description: string;
  isConnected: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  isLast?: boolean;
}

interface SectionCardProps {
  children: React.ReactNode;
}

const SectionCard: React.FC<SectionCardProps> = ({ children }) => {
  return (
    <div className={combineClasses(componentClasses.card, "py-6 px-3 lg:px-6")}>
      {children}
    </div>
  );
};

const ConnectionItem: React.FC<ConnectionItemProps> = ({
  icon,
  name,
  description,
  isConnected,
  onConnect,
  onDisconnect,
  isLast = false,
}) => {
  return (
    <div
      className={`flex items-center justify-between py-5 ${!isLast ? `border-b ${borderClasses.divider}` : ""}`}
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 relative">
          <Image
            src={icon || "/placeholder.svg"}
            alt={name}
            width={54}
            height={50}
            className="object-contain"
          />
        </div>
        <div>
          <h3
            className={combineClasses(
              textClasses.primary,
              "text-lg font-medium"
            )}
          >
            {name}
          </h3>
          <p className={textClasses.tertiary}>{description}</p>
        </div>
      </div>
      {isConnected ? (
        <button
          className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg transition-colors"
          onClick={onDisconnect}
        >
          Disconnect
        </button>
      ) : (
        <button
          className={combineClasses(
            buttonClasses.secondary,
            "px-6 py-2 rounded-lg"
          )}
          onClick={onConnect}
        >
          Connect
        </button>
      )}
    </div>
  );
};

const ConnectionsPage: React.FC = () => {
  // Connection data
  const connections = [
    {
      id: "discord",
      icon: DiscordLogo,
      name: "Discord",
      description: "Join community servers and chat with followers",
      isConnected: false,
    },
    {
      id: "steam",
      icon: SteamLogo,
      name: "Steam",
      description: "Share visual content across platforms",
      isConnected: false,
    },
    {
      id: "youtube",
      icon: YoutubeLogo,
      name: "Youtube",
      description: "Connected to [Channel Name] 12 hours ago",
      isConnected: true,
    },
  ];

  const handleConnect = (id: string) => {
    console.log(`Connecting to ${id}...`);
    // Implement connection logic here
  };

  const handleDisconnect = (id: string) => {
    console.log(`Disconnecting from ${id}...`);
    // Implement disconnection logic here
  };

  return (
    <div
      className={combineClasses(
        "min-h-screen",
        bgClasses.secondary,
        textClasses.primary
      )}
    >
      <div className="max-w-8xl mx-auto">
        <SectionCard>
          <h2
            className={combineClasses(
              textClasses.highlight,
              "text-xl font-medium mb-2"
            )}
          >
            Recommended Connections
          </h2>
          <p
            className={combineClasses(
              textClasses.tertiary,
              "text-sm italic mb-8"
            )}
          >
            Link your external accounts to enhance your experience across
            platforms. When you connect an account, we may share limited profile
            information and activity data based on your privacy settings. You
            can disconnect accounts at any time, which will revoke all sharing
            permissions. We never post on your behalf without explicit
            permission for each action.
          </p>

          {connections.map((connection, index) => (
            <ConnectionItem
              key={connection.id}
              icon={connection.icon}
              name={connection.name}
              description={connection.description}
              isConnected={connection.isConnected}
              onConnect={() => handleConnect(connection.id)}
              onDisconnect={() => handleDisconnect(connection.id)}
              isLast={index === connections.length - 1}
            />
          ))}
        </SectionCard>
      </div>
    </div>
  );
};

export default ConnectionsPage;
