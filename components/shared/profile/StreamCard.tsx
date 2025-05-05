import Image from "next/image"
import Link from "next/link"
import { Eye } from "lucide-react"

interface StreamCardProps {
  id: string
  title: string
  thumbnailUrl: string
  username: string
  category: string
  tags: string[]
  viewCount: number
  isLive: boolean
}

const StreamCard = ({ id, title, thumbnailUrl, username, category, tags, viewCount, isLive }: StreamCardProps) => {
  return (
    <Link href={`/${username}/watch?v=${id}`}>
      <div className="group cursor-pointer">
        <div className="relative aspect-video rounded-md overflow-hidden mb-2">
          <Image
            src={thumbnailUrl || "/placeholder.svg?height=180&width=320"}
            alt={title}
            fill
            className="object-cover transition-transform group-hover:scale-105"
          />

          {isLive && (
            <div className="absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-1 rounded-sm">Live</div>
          )}

          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-sm flex items-center">
            <Eye className="h-3 w-3 mr-1" />
            <span>{viewCount >= 1000 ? `${(viewCount / 1000).toFixed(1)}K` : viewCount}</span>
          </div>
        </div>

        <div className="flex items-center mb-1">
          <div className="w-4 h-4 bg-blue-500 rounded-full mr-2 flex-shrink-0 overflow-hidden">
            <Image
              src="/placeholder.svg?height=16&width=16"
              alt={category}
              width={16}
              height={16}
              className="object-cover"
            />
          </div>
          <span className="text-xs text-gray-400">{category}</span>
        </div>

        <h3 className="text-sm font-medium text-white mb-1 line-clamp-1">{title}</h3>

        <div className="flex flex-wrap gap-1 mt-1">
          {tags.map((tag) => (
            <span key={tag} className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </Link>
  )
}

export default StreamCard
