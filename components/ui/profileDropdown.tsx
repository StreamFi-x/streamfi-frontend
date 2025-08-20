"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import {
  Globe,
  Settings,
  LogOut,
  MonitorPlay,
  LayoutDashboard,
} from "lucide-react";
import { motion, easeInOut, easeOut } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { useAccount, useDisconnect } from "@starknet-react/core";

import { Flag } from "lucide-react";

interface MenuItem {
  icon: ReactNode;
  label: string;
  route?: string; // Added route property
  onClick?: (item: MenuItem) => void; // Optional onClick handler
  mobile: boolean; // Flag to indicate if the item is for mobile
}

interface MenuSection {
  id: string;
  items: MenuItem[];
}

// Menu item component props
interface MenuItemProps {
  icon: ReactNode;
  label: string;
  route?: string;
  onClick: (item: MenuItem) => void;
}

const MenuItem = ({ icon, label, route, onClick }: MenuItemProps) => {
  if (label === "Disconnect") {
    return (
      <div
        className="flex items-center px-4 py-3 cursor-pointer hover:bg-surface-hover text-foreground"
        onClick={() => onClick({ icon, label, route, mobile: true })}
      >
        <div className="text-foreground mr-3">{icon}</div>
        <span className="text-foreground text-base">{label}</span>
      </div>
    );
  }

  return (
    <Link
      href={route || "#"}
      className="flex items-center px-4 py-3 cursor-pointer hover:bg-surface-hover text-foreground"
      onClick={e => {
        e.preventDefault();
        onClick({ icon, label, route, mobile: true });
      }}
    >
      <div className="text-foreground mr-3">{icon}</div>
      <span className="text-foreground text-base">{label}</span>
    </Link>
  );
};

interface MenuSectionProps {
  items: MenuItem[];
  onClick: (item: MenuItem) => void;
}

const MenuSection = ({ items, onClick }: MenuSectionProps) => {
  return (
    <>
      {items.map((item, index: number) => (
        <MenuItem
          key={`${item.label}-${index}`}
          icon={item.icon}
          label={item.label}
          route={item.route}
          onClick={onClick}
        />
      ))}
    </>
  );
};

interface UserProfileProps {
  avatar: import("next/image").StaticImageData | string; // Accepts StaticImageData or string URL
  name: string;
  onClick?: () => void;
}

const UserProfile = ({ avatar, name, onClick }: UserProfileProps) => {
  return (
    <div
      className="px-3 py-2 sm:p-4 flex items-center space-x-3 sm:space-x-3 cursor-pointer border-b border-border text-foreground"
      onClick={onClick}
    >
      <div className="relative w-9 h-9 rounded-full 0 overflow-hidden">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={
              typeof avatar === "string"
                ? avatar
                : avatar?.src || "/Images/user.png"
            }
            alt="User avatar"
            // sizes="40px"
            className="object-cover rounded-full"
            onError={e => {
              // If image fails to load, replace with placeholder
              const target = e.target as HTMLImageElement;
              target.src = "/Images/user.png";
            }}
          />
        ) : (
          <Image
            src="/Images/user.png"
            alt="Default avatar"
            fill
            sizes="40px"
            className="object-cover"
          />
        )}
      </div>
      <span className="text-foreground font-medium sm:text-lg">{name}</span>
    </div>
  );
};

interface UserDropdownProps {
  username: string;
  avatar?: string | null;
  onLinkClick?: (route: string) => void; // Optional callback for link clicks
  linkClick?: () => void; // Optional callback for link clicks
}

const UserDropdown = ({ username, avatar, onLinkClick }: UserDropdownProps) => {
  const router = useRouter();
  const userAvatar = avatar;
  const { disconnect } = useDisconnect();
  const { isConnected } = useAccount();
  const userName = username;
  const { logout } = useAuth(); // Use our auth context for logout

  // Menu data structure with routes
  const menuItems: MenuSection[] = [
    {
      id: "main",
      items: [
        {
          icon: <MonitorPlay size={20} />,
          label: "Channel",
          route: `/${username}`,
          mobile: true,
        },
        {
          icon: <LayoutDashboard size={20} />,
          label: "Creator Dashboard",
          route: "/dashboard/stream-manager",
          mobile: false,
        },
        {
          icon: <Globe size={20} />,
          label: "Language",
          route: "",
          mobile: false,
        },
        {
          icon: <Settings size={20} />,
          label: "Settings",
          route: "/settings",
          mobile: true,
        },
      ],
    },
    {
      id: "footer",
      items: [
        {
          icon: <LogOut size={20} />,
          label: "Disconnect",
          route: "/explore",
          mobile: true,
        },
        {
          icon: <Flag size={20} />,
          label: "Report a Bug",
          route: "/explore/report-bug",
          mobile: true,
        },
      ],
    },
  ];

  const handleItemClick = (item: MenuItem) => {
    console.log(`Clicked on ${item.label}`);

    if (item.label === "Disconnect") {
      if (isConnected) {
        disconnect();
      }
      logout();
      if (onLinkClick) onLinkClick(item.route || "/explore");
      return;
    }

    if (item.route) {
      router.push(item.route);
      if (onLinkClick) onLinkClick(item.route);
    } else {
      if (onLinkClick) onLinkClick("");
    }
  };

  // Animation variants

  const dropdownVariants = {
    hidden: {
      opacity: 0,
      y: -5,
      scale: 0.95,
      transition: {
        duration: 0.2,
        ease: easeInOut,
      },
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.2,
        ease: easeOut,
      },
    },
  };

  return (
    <motion.div
      className="relative sm:w-52 w-40 z-50"
      initial="hidden"
      animate="visible"
      exit="hidden"
      variants={dropdownVariants}
    >
      <div className="bg-card border border-border shadow-sm rounded-lg text-foreground">
        <UserProfile
          avatar={userAvatar ? userAvatar : "placeholder.svg"}
          name={userName}
          onClick={() => {}} // Empty function since toggle is handled by parent
        />

        <div className="block">
          {menuItems.map((section, index) => (
            <div
              key={section.id}
              className={`py-2 ${index > 0 ? "border-t border-border" : ""}`}
            >
              {section.items.map(item => (
                <div
                  key={item.label}
                  className={item.mobile ? "block " : "hidden lg:block"}
                  onClick={() => handleItemClick(item)}
                >
                  <div className="hover:bg-surface-hover flex items-center gap-2.5 px-4 py-2 sm:text-sm text-sm cursor-pointer rounded">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default UserDropdown;
