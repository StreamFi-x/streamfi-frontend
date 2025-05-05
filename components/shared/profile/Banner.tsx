import Link from "next/link"
import { Button } from "@/components/ui/button"

interface BannerProps {
  username: string
  isLive: boolean
  streamTitle?: string
}

const Banner = ({ username, isLive, streamTitle }: BannerProps) => {
  return (
    <div className="relative w-full h-[200px] bg-gradient-to-r from-gray-900 to-gray-800 overflow-hidden">
      {/* Background collage of images */}
      <div className="absolute inset-0 grid grid-cols-3 grid-rows-2 gap-1 opacity-50">
        <div
          className="bg-cover bg-center"
          style={{ backgroundImage: `url('/placeholder.svg?height=300&width=400')` }}
        ></div>
        <div
          className="bg-cover bg-center"
          style={{ backgroundImage: `url('/placeholder.svg?height=300&width=400')` }}
        ></div>
        <div
          className="bg-cover bg-center"
          style={{ backgroundImage: `url('/placeholder.svg?height=300&width=400')` }}
        ></div>
        <div
          className="bg-cover bg-center"
          style={{ backgroundImage: `url('/placeholder.svg?height=300&width=400')` }}
        ></div>
        <div
          className="bg-cover bg-center"
          style={{ backgroundImage: `url('/placeholder.svg?height=300&width=400')` }}
        ></div>
        <div
          className="bg-cover bg-center"
          style={{ backgroundImage: `url('/placeholder.svg?height=300&width=400')` }}
        ></div>
      </div>

      {/* Banner content */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center p-6 max-w-lg">
          {isLive ? (
            <>
              <div className="flex items-center justify-center mb-2">
                <span className="bg-red-600 text-white text-xs px-2 py-1 rounded-sm mr-2">Live</span>
              </div>
              <h2 className="text-white text-2xl font-bold mb-3">
                {username} is streaming
                <br />
                co-working and designing
              </h2>
              <Link href={`/${username}/watch`}>
                <Button variant="secondary" size="sm" className="bg-purple-600 hover:bg-purple-700 text-white">
                  Watch Now
                </Button>
              </Link>
            </>
          ) : (
            <>
              <div className="flex items-center justify-center mb-2">
                <span className="bg-gray-600 text-white text-xs px-2 py-1 rounded-sm mr-2">OFFLINE</span>
              </div>
              <h2 className="text-white text-2xl font-bold mb-3">{username} is offline</h2>
              <p className="text-gray-300 text-sm mb-3">Follow and get notified when {username} goes live</p>
              <Button variant="secondary" size="sm" className="bg-purple-600 hover:bg-purple-700 text-white">
                Turn on Notifications
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default Banner
