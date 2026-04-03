"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Settings, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface CustomizeChannelButtonProps {
  username: string;
}

const CustomizeChannelButton = ({ username }: CustomizeChannelButtonProps) => {
  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/${username}`
      );
      toast.success("Profile link copied to clipboard");
    } catch {
      toast.error("Could not copy link");
    }
  };

  return (
    <div className="flex items-center space-x-1">
      <Link href="/settings/profile">
        <Button
          variant="outline"
          className="bg-gray-800 hover:bg-gray-700 text-white border-none flex items-center"
        >
          <Settings className="h-4 w-4 sm:mr-2" />
          Customize
          <span className="hidden sm:block"> Channel</span>
        </Button>
      </Link>
      <Button
        onClick={handleShare}
        className="bg-transparent hover:bg-gray-700 text-white border-gray-600 !ml-1 p-1"
        aria-label="Copy profile link"
      >
        <ExternalLink className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default CustomizeChannelButton;
