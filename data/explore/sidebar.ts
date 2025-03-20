import { Home, TrendingUp, Clock, Radio, Heart,  } from "lucide-react";

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
export  const overlayVariants = {
    open: { opacity: 0.5 },
    closed: { opacity: 0 },
  };

 export const navItems = [
    { icon: Home, label: "Home", href: "/explore" },
    { icon: TrendingUp, label: "Trending", href: "/trending" },
    { icon: Clock, label: "Watch Later", href: "/watch-later" },
    { icon: Radio, label: "Live", href: "/live" },
    { icon: Heart, label: "Saved Videos", href: "/saved" },
  ];

 export const recommendedUsers = [
    {
      name: "Zyn",
      status: "2.1K watching",
      avatar: "/icons/Recommend pfps.svg",
    },
    {
      name: "monki",
      status: "1.5K watching",
      avatar: "/icons/Recommend pfps (1).svg",
    },
    {
      name: "Guraissay",
      status: "Offline",
      avatar: "/icons/Recommend pfps (2).svg",
    },
  ];
