import { Button } from "@/components/ui/button";
import { Search, Users, Video, Gamepad2 } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: "search" | "users" | "video" | "gamepad";
  actionLabel?: string;
  onAction?: () => void;
  showAction?: boolean;
}

export function EmptyState({
  title,
  description,
  icon = "search",
  actionLabel = "Clear filters",
  onAction,
  showAction = true,
}: EmptyStateProps) {
  const getIcon = () => {
    switch (icon) {
      case "users":
        return <Users className="h-16 w-16" />;
      case "video":
        return <Video className="h-16 w-16" />;
      case "gamepad":
        return <Gamepad2 className="h-16 w-16" />;
      default:
        return <Search className="h-16 w-16" />;
    }
  };

  return (
    <div className=" p-16 rounded-lg my-5 border border-gray-200 text-center">
      <div className="h-16 w-16 mx-auto mb-6 text-gray-400">{getIcon()}</div>
      <h3 className="text-xl font-semibold mb-4">{title}</h3>
      <p className="text-gray-400 mb-6">{description}</p>
      {showAction && onAction && (
        <Button
          onClick={onAction}
          variant="outline"
          className="border-gray-600  hover:bg-gray-700"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
