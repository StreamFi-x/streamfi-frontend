import { notFound } from "next/navigation";
import ViewStream from "@/components/stream/view-stream";

interface PageProps {
  params: {
    username: string;
  };
}

const WatchPage = ({ params }: PageProps) => {
  const { username } = params;

  // Mock function to check if user exists - would be a DB call in real app
  const userExists = true;

  if (!userExists) {
    return notFound();
  }

  return <ViewStream username={username} isLive={true} />;
};

export default WatchPage;
