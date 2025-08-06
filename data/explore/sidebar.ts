import { Home, TrendingUp, Clock, Radio, Heart } from "lucide-react";
import { Bell, Mail, MessageSquare, UserPlus, AtSign } from "lucide-react";
import BrowseIcon from "@/components/icons/browse-icon";

export const sidebarVariants = {
  open: {
    x: 0,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 30,
    },
  },
  closed: {
    x: "-100%",
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 30,
    },
  },
};

export const overlayVariants = {
  open: { opacity: 0.5 },
  closed: { opacity: 0 },
};

export const navItems = [
  { icon: Home, label: "Home", href: "/" },
  { icon: BrowseIcon, label: "Browse", href: "/explore/browse" },
  { icon: TrendingUp, label: "Trending", href: "/trending" },
  { icon: Clock, label: "Watch Later", href: "/watch-later" },
  { icon: Radio, label: "Live", href: "/live" },
  { icon: Heart, label: "Saved Videos", href: "/saved" },
];

export const recommendedUsers = [
  {
    name: "Zyn",
    status: "2.75K watching",
    avatar: "/icons/recommend-pfps.svg",
  },
  {
    name: "monki",
    status: "1.75K watching",
    avatar: "/icons/recommend-pfps-(1).svg",
  },
  {
    name: "Guraissay",
    status: "Offline",
    avatar: "/icons/recommend-pfps-(2).svg",
  },
];

export const notificationSettings = [
  {
    id: "push_notifications",
    label: "Push Notifications",
    description: "Receive notifications on your device",
    enabled: true,
    icon: Bell,
  },
  {
    id: "email_notifications",
    label: "Email Notifications",
    description: "Receive notifications via email",
    enabled: true,
    icon: Mail,
  },
  {
    id: "new_messages",
    label: "New Messages",
    description: "Get notified when you receive new messages",
    enabled: true,
    icon: MessageSquare,
  },
  {
    id: "new_likes",
    label: "Likes & Reactions",
    description: "Get notified when someone likes your content",
    enabled: true,
    icon: Heart,
  },
  {
    id: "new_followers",
    label: "New Followers",
    description: "Get notified when someone follows you",
    enabled: true,
    icon: UserPlus,
  },
  {
    id: "mentions",
    label: "Mentions",
    description: "Get notified when someone mentions you",
    enabled: true,
    icon: AtSign,
  },
];
