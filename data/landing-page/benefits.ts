import type { StaticImageData } from "next/image";
import { CommunityIcon, MoneyLink } from "@/public/icons";

export interface Benefit {
  title: string;
  description: string;
  icon?: StaticImageData;
}

// Benefits data (move this to data/landing-page/benefits.ts if needed)
export const benefits = [
  {
    title: "Decentralized Monetization",
    description:
      "No middlemen. You keep 100% of your earnings. StreamFi enables direct, peer-to-peer transactions, ensuring creators receive 100% of tips and earnings with no corporate cuts.",
    icon: MoneyLink,
  },
  {
    title: "Ad-Free Experience",
    description:
      "Enjoy uninterrupted, high-quality streaming. StreamFi offers an ad-free environment where creators monetize directly through subscriptions, tips, and staking, not ads.",
  },
  {
    title: "Direct Fan Engagement",
    description:
      "Build stronger communities with direct interactions. With traditional platforms, fans are just viewers; on StreamFi, they're active supporters.",
  },
  {
    title: "Community-Driven Governance",
    description:
      "Have a say in the future of StreamFi. Unlike centralized platforms where policy changes hurt creators (e.g., demonetization), StreamFi is community-owned.",
    icon: CommunityIcon,
  },
];
