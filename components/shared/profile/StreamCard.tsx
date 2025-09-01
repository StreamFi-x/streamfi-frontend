import Image from "next/image";
import Link from "next/link";
import { Eye } from "lucide-react";
// import { useRouter } from "next/navigation";
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
  // category,
  tags,
  viewCount,
  isLive,
}: StreamCardProps) => {
  // const route = useRouter();
  return (
    <Link href={`/${username}/watch?v=${id}`}>
      <div className="group cursor-pointer rounded-lg overflow-hidden transition-colors">
        <div className="relative aspect-video overflow-hidden">
          {typeof thumbnailUrl === "string" &&
          thumbnailUrl.includes("cloudinary.com") ? (
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
            <div className="absolute top-1 left-1 bg-red-600 text-white text-xs px-3 py-1.5 rounded-sm font-medium">
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

        <div className="p-2 truncate">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 bg-gray-600 rounded-full  flex-shrink-0 overflow-hidden">
              {typeof thumbnailUrl === "string" &&
              thumbnailUrl.includes("cloudinary.com") ? (
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
            <div className="flex flex-col truncate">
              {" "}
              <a
                href={`/${username}`}
                className="text-xs hover:underline text-gray-400 font-medium"
              >
                {username}
              </a>
            </div>
          </div>
          <h3 className="text-sm font-semibold mb-1 truncate w-full line-clamp-2">
            {title} What does this mean?
          </h3>

          <div className="flex flex-wrap gap-2">
            {tags.slice(0, 3).map(tag => (
              <span
                key={tag}
                className="text-xs  px-2 py-1.5 rounded bg-tag text-background"
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
