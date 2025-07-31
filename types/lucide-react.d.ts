declare module "lucide-react";

declare module "lucide-react" {
  import { FC, SVGProps } from "react";

  export interface IconProps extends SVGProps<SVGSVGElement> {
    size?: number | string;
    color?: string;
    strokeWidth?: number | string;
  }

  export type Icon = FC<IconProps>;

  export const Edit2: Icon;
  export const Trash2: Icon;
  export const Check: Icon;
  export const X: Icon;
  export const Instagram: Icon;
  export const Facebook: Icon;
  export const Twitch: Icon;
  export const Youtube: Icon;
  export const Twitter: Icon;
  export const Settings: Icon;
  export const LogOut: Icon;
  export const MonitorPlay: Icon;
  export const LayoutDashboard: Icon;
  export const Globe: Icon;
  export const ChevronDown: Icon;
  export const ExternalLink: Icon;
  export const Home: Icon;
  export const Menu: Icon;
  export const User: Icon;
  export const ArrowRight: Icon;
}
