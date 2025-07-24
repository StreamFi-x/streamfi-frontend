import Image from "next/image";
import Link from "next/link";
import { Eye } from "lucide-react";

interface StreamCardProps {
  id: string;
  title: string;
  thumbnailUrl: string;
  username: string;
  category: string;
  tags: string[];
  viewCount: number;
  isLive: boolean;
}

const StreamCard = ({
  id,
  title,
  thumbnailUrl,
  username,
  category,
  tags,
  viewCount,
  isLive,
}: StreamCardProps) => {
  return (
    <Link href={`/${username}/watch?v=${id}`}>
      <div className="group cursor-pointer bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-700 transition-colors">
        <div className="relative aspect-video overflow-hidden">
          <Image
            src={thumbnailUrl || "/placeholder.svg?height=180&width=320"}
            alt={title}
            fill
            className="object-cover transition-transform group-hover:scale-105"
          />

          {isLive && (
            <div className="absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-1 rounded-sm font-medium">
              Live
            </div>
          )}

          <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-sm flex items-center">
            <Eye className="h-3 w-3 mr-1" />
            <span>
              {viewCount >= 1000
                ? `${(viewCount / 1000).toFixed(1)}k`
                : viewCount}
            </span>
          </div>
        </div>

        <div className="p-3">
          <div className="flex items-center mb-2">
            <div className="w-6 h-6 bg-gray-600 rounded-full mr-2 flex-shrink-0 overflow-hidden">
              <Image
                src={thumbnailUrl || "/placeholder.svg?height=180&width=320"}
                alt={username}
                width={24}
                height={24}
                className="object-cover"
              />
            </div>
            <span className="text-sm text-gray-300 font-medium">
              {username}
            </span>
          </div>

          <h3 className="text-sm font-semibold text-white mb-2 line-clamp-2">
            {title}
          </h3>

          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
};

export default StreamCard;
