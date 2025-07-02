export interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface ConnectModalProps {
  isOpen: boolean;
  currentStep: "profile" | "verify" | "success";
  onClose: () => void;
  onNextStep: (step: "profile" | "verify" | "success") => void;
}

export interface NavbarProps {
  toggleSidebar: () => void;
  onConnect?: () => void;
}

export interface SearchResult {
  id: string;
  title: string;
  type: "stream" | "channel" | "video";
  image: string;
}
