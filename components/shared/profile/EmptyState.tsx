import { Button } from "@/components/ui/button";
import { VideoIcon, Scissors, Upload } from "lucide-react";

interface EmptyStateProps {
  type: "videos" | "clips";
  isOwner: boolean;
  username: string;
}

const EmptyState = ({ type, isOwner, username }: EmptyStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="bg-tertiary w-16 h-16 rounded-full flex items-center justify-center mb-4">
        {type === "videos" ? (
          <VideoIcon className="text-muted-foreground h-8 w-8" />
        ) : (
          <Scissors className="text-muted-foreground h-8 w-8" />
        )}
      </div>

      <h2 className="text-foreground text-xl font-medium mb-2">
        {isOwner
          ? `You don't have any ${type} yet`
          : `${username} doesn't have any ${type} yet`}
      </h2>

      <p className="text-muted-foreground max-w-md mb-6">
        {isOwner
          ? type === "videos"
            ? "Your past streams will appear here once you start streaming."
            : "Create clips from your favorite moments during streams."
          : type === "videos"
            ? `${username} hasn't uploaded any videos yet.`
            : `${username} hasn't created any clips yet.`}
      </p>

      {isOwner && (
        <Button className="bg-highlight hover:bg-highlight/80 text-primary-foreground">
          <Upload className="h-4 w-4 mr-2" />
          {type === "videos" ? "Upload a Video" : "Create a Clip"}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;
