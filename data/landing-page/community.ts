import { CardProps } from "@/types/landing-page";
import key from "../../public/Images/key.png";
import bulb from "../../public/Images/bulb.png";
import podcast from "../../public/Images/podcast.png";
import folder from "../../public/Images/folder.png";

export const cards: CardProps[] = [
  {
    icon: key,
    title: "Exclusive Beta Access",
    description: "Be first to try out new features",
  },
  {
    icon: bulb,
    title: "Knowledge Based & Resources",
    description: "Learn everything about web3 streaming and monitization",
  },
  {
    icon: podcast,
    title: "Networking Opportunities",
    description: "Connect with top creators, investors and web3 pioneers",
  },
  {
    icon: folder,
    title: "Earning Potential",
    description:
      "Unlock multiple revenue streams through decentralised streaming",
  },
];
