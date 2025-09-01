import { UserX, Search, Home } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface UserNotFoundProps {
  username: string;
}

export default function UserNotFound({ username }: UserNotFoundProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center p-8 max-w-md">
        <div className="mx-auto w-16 h-16 mb-6 text-gray-400">
          <UserX className="w-full h-full" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-4">
          User Not Found
        </h1>
        <p className="text-muted-foreground mb-6">
          The user{" "}
          <span className="font-mono text-foreground">@{username}</span> could
          not be found. They may have changed their username or the account may
          have been deleted.
        </p>
        <div className="space-y-3">
          <Button asChild className="w-full">
            <Link href="/explore">
              <Search className="w-4 h-4 mr-2" />
              Explore Streams
            </Link>
          </Button>
          <Button variant="outline" asChild className="w-full">
            <Link href="/">
              <Home className="w-4 h-4 mr-2" />
              Go Home
            </Link>
          </Button>
        </div>
        <div className="mt-8 p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">
            Looking for someone? Try searching for them in the explore section
            or check if you have the correct username.
          </p>
        </div>
      </div>
    </div>
  );
}
