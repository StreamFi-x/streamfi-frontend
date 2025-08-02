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
      <div className="group cursor-pointer rounded-lg overflow-hidden transition-colors">
        <div className="relative aspect-video overflow-hidden">
          {typeof thumbnailUrl === 'string' && thumbnailUrl.includes('cloudinary.com') ? (
            <img
              src={thumbnailUrl}
              alt={title}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <Image
              src={thumbnailUrl || "/placeholder.svg?height=180&width=320"}
              alt={title}
              fill
              className="object-cover transition-transform group-hover:scale-105"
            />
          )}

          {isLive && (
            <div className="absolute top-3 left-3 bg-red-600 text-white text-sm px-3 py-1.5 rounded-sm font-medium">
              Live
            </div>
          )}

          <div className="absolute top-3 right-3 bg-black/70 text-white text-sm px-3 py-1.5 rounded-sm flex items-center">
            <Eye className="h-4 w-4 mr-1.5" />
            <span>
              {viewCount >= 1000
                ? `${(viewCount / 1000).toFixed(1)}k`
                : viewCount}
            </span>
          </div>
        </div>

        <div className="p-4">
          <div className="flex items-center mb-3">
            <div className="w-8 h-8 bg-gray-600 rounded-full mr-3 flex-shrink-0 overflow-hidden">
              {typeof thumbnailUrl === 'string' && thumbnailUrl.includes('cloudinary.com') ? (
                <img
                  src={thumbnailUrl}
                  alt={username}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Image
                  src={thumbnailUrl || "/placeholder.svg?height=180&width=320"}
                  alt={username}
                  width={32}
                  height={32}
                  className="object-cover"
                />
              )}
            </div>
            <span className="text-base text-gray-300 font-medium">
              {username}
            </span>
          </div>

          <h3 className="text-base font-semibold text-white mb-3 line-clamp-2">
            {title}
          </h3>

          <div className="flex flex-wrap gap-2">
            {tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-sm px-3 py-1.5 rounded bg-gray-700 text-gray-300"
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
