import Link from "next/link"
import { Button } from "@/components/ui/button"
import { BellDot, Dot } from "lucide-react"
import { textClasses, buttonClasses, bgClasses, combineClasses } from "@/lib/theme-classes"

interface BannerProps {
  username: string
  isLive: boolean
  streamTitle?: string
}

const Banner = ({ username, isLive, streamTitle }: BannerProps) => {
  return (
    <div
      className="relative font-inter w-full h-[280px] xl:h-[320px] bg-gradient-to-r from-gray-900 to-gray-800 overflow-hidden bg-center bg-no-repeat bg-cover"
      style={{
        backgroundImage: `url('/images/banner-bg.png')`,
      }}
    >
      <div className="absolute top-0 left-0 w-1/3 h-full bg-gradient-to-r from-[#17191A]/90 to-transparent z-10" />
      <div className="absolute top-0 right-0 w-1/4 h-full bg-gradient-to-l from-[#17191A]/90 to-transparent z-10" />

      <div className="absolute inset-0 flex items-center px-10 justify-start z-20">
        <div className={combineClasses(bgClasses.card, "p-8 w-full max-w-sm xl:max-w-md rounded-md")}>
          {isLive ? (
            <>
              <div className="flex items-center justify-start mb-2">
                <span
                  className={combineClasses(
                    "flex items-center bg-red-600",
                    textClasses.onColor,
                    "text-xs px-2 py-1 rounded-lg font-semibold",
                  )}
                >
                  <Dot size={20} className={textClasses.onColor} />
                  Live
                </span>
              </div>
              <h2 className={combineClasses(textClasses.primary, "text-xl font-medium mb-6")}>
                {username} is streaming
                <br />
                {streamTitle}
              </h2>
              <Link href={`/${username}/watch`}>
                <Button className={combineClasses(textClasses.highlight, "font-semibold text-xs bg-transparent p-0")}>
                  Watch Now
                </Button>
              </Link>
            </>
          ) : (
            <>
              <div className="flex items-center justify-start">
                <span
                  className={combineClasses(bgClasses.tertiary, textClasses.primary, "text-xs px-2 py-1 rounded-sm")}
                >
                  OFFLINE
                </span>
              </div>
              <h2 className={combineClasses(textClasses.primary, "text-xl font-medium")}>{username} is offline</h2>
              <p className={combineClasses(textClasses.tertiary, "text-xs mb-3")}>
                Follow and get notified when {username} goes live
              </p>
              <Button
                className={combineClasses(
                  "flex items-center gap-1",
                  buttonClasses.primary,
                  textClasses.onColor,
                  "text-[10px]",
                )}
              >
                <BellDot size={12} />
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
