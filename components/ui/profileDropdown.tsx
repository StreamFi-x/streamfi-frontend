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
import User from "@/public/Images/user.png";
import { motion, easeInOut, easeOut } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { useAccount, useDisconnect } from "@starknet-react/core";
import {
  bgClasses,
  textClasses,
  borderClasses,
  combineClasses,
} from "@/lib/theme-classes";

// Define types for menu items
interface MenuItem {
  icon: ReactNode;
  label: string;
  route?: string; // Added route property
  onClick?: (item: MenuItem) => void; // Optional onClick handler
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
        className={combineClasses(
          "flex items-center px-4 py-3 cursor-pointer",
          bgClasses.hover,
          textClasses.primary
        )}
        onClick={() => onClick({ icon, label, route })}
      >
        <div className={combineClasses(textClasses.primary, "mr-3")}>
          {icon}
        </div>
        <span className={combineClasses(textClasses.primary, "text-base")}>
          {label}
        </span>
      </div>
    );
  }

  return (
    <Link
      href={route || "#"}
      className={combineClasses(
        "flex items-center px-4 py-3 cursor-pointer",
        bgClasses.hover,
        textClasses.primary
      )}
      onClick={(e) => {
        e.preventDefault();
        onClick({ icon, label, route });
      }}
    >
      <div className={combineClasses(textClasses.primary, "mr-3")}>{icon}</div>
      <span className={combineClasses(textClasses.primary, "text-base")}>
        {label}
      </span>
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
      className={combineClasses(
        "p-4 flex items-center space-x-3 cursor-pointer border-b",
        borderClasses.divider,
        textClasses.primary
      )}
      onClick={onClick}
    >
      <div className="relative w-10 h-10 rounded-full bg-purple-600 overflow-hidden">
        {avatar ? (
          <Image
            src={avatar || "/placeholder.svg"}
            alt="User avatar"
            fill
            sizes="40px"
            className="object-cover"
            onError={(e) => {
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
      <span
        className={combineClasses(textClasses.primary, "font-medium text-lg")}
      >
        {name}
      </span>
    </div>
  );
};

interface UserDropdownProps {
  username: string;
  onLinkClick?: (route: string) => void;
}

const UserDropdown = ({ username, onLinkClick }: UserDropdownProps) => {
  const router = useRouter();
  const userAvatar = User;
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
        },
        {
          icon: <LayoutDashboard size={20} />,
          label: "Creator Dashboard",
          route: "/dashboard/stream-manager",
        },
        { icon: <Globe size={20} />, label: "Language", route: "" },
        { icon: <Settings size={20} />, label: "Settings", route: "/settings" },
      ],
    },
    {
      id: "footer",
      items: [
        { icon: <LogOut size={20} />, label: "Disconnect", route: "/explore" },
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
      if (onLinkClick) onLinkClick(item.route || "");
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
      className="relative w-64 z-50"
      initial="hidden"
      animate="visible"
      exit="hidden"
      variants={dropdownVariants}
    >
      <div className={combineClasses(bgClasses.dropdown, textClasses.primary)}>
        <UserProfile
          avatar={userAvatar}
          name={userName}
          onClick={() => {}} // Empty function since toggle is handled by parent
        />

        <div className="block">
          {menuItems.map((section, index) => (
            <div
              key={section.id}
              className={combineClasses(
                "py-2",
                index > 0 ? `border-t ${borderClasses.divider}` : ""
              )}
            >
              <MenuSection items={section.items} onClick={handleItemClick} />
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default UserDropdown;
