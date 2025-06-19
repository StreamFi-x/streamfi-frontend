"use client"

import { useState, useEffect } from "react"
import { Eye, ChevronDown, ChevronUp } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import Button from "@/components/ui/button"
import type { TrendingStreamsProps } from "@/types/explore/home"
import { textClasses, bgClasses, buttonClasses, combineClasses } from "@/lib/theme-classes"

export function TrendingStreams({ title, streams }: TrendingStreamsProps) {
  const [visibleStreams, setVisibleStreams] = useState(4)
  const [expanded, setExpanded] = useState(false)
  const [isCollapsing, setIsCollapsing] = useState(false)

  const getInitialCount = () => {
    if (typeof window === "undefined") return 4
    if (window.innerWidth < 640) return 2 // Mobile: 2 cards
    if (window.innerWidth < 1024) return 3 // Tablet: 3 cards
    return 4 // Desktop: 4 cards
  }

  const getIncrementCount = () => {
    if (typeof window === "undefined") return 4
    if (window.innerWidth < 640) return 2 // Mobile: +2 cards
    if (window.innerWidth < 1024) return 3 // Tablet: +3 cards
    return 4 // Desktop: +4 cards
  }

  // Initialize with the correct count based on screen size
  useEffect(() => {
    setVisibleStreams(getInitialCount())

    // Update count on window resize
    const handleResize = () => {
      if (!expanded) {
        setVisibleStreams(getInitialCount())
      }
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [expanded])

  const handleSeeMore = () => {
    setVisibleStreams((prev) => prev + getIncrementCount())
    setExpanded(true)
  }

  const handleSeeLess = () => {
    setIsCollapsing(true)
    // Delay the actual collapse to allow for animation
    setTimeout(() => {
      setVisibleStreams(getInitialCount())
      setExpanded(false)
      setIsCollapsing(false)
    }, 500) // Match this with the animation duration
  }

  // Calculate which items should be animated out during collapse
  const getItemVariants = (index: number) => {
    if (isCollapsing && index >= getInitialCount()) {
      return {
        hidden: {
          opacity: 0,
          y: 20,
          scale: 0.9,
          transition: {
            duration: 0.4,
            delay: 0.05 * (visibleStreams - index), // Stagger from bottom to top
          },
        },
        visible: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: { duration: 0.3 },
        },
      }
    }

    return {
      hidden: { opacity: 0, y: 20 },
      visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.3 },
      },
    }
  }

  return (
    <div className="w-full py-6">
      <h2 className={combineClasses("text-2xl font-bold mb-6", textClasses.primary)}>{title}</h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4  gap-y-6 md:gap-y-10">
        <AnimatePresence>
          {streams.slice(0, visibleStreams).map((stream, index) => (
            <motion.div
              key={stream.id}
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={getItemVariants(index)}
              className={`${bgClasses.card} group cursor-pointer  p-2 pb-4 rounded-lg`}
            >
              <div className="relative rounded-lg overflow-hidden">
                <img
                  src={stream.thumbnail || "/placeholder.svg"}
                  alt={stream.title}
                  className="w-full aspect-video object-cover transition-transform group-hover:scale-105"
                />

                <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-0.5 text-sm rounded">Live</div>

                <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-0.5 text-sm rounded flex items-center">
                  <Eye className="w-3 h-3 mr-1" />
                  {stream.viewCount}
                </div>
              </div>

              <div className="mt-2 flex flex-col items-start gap-2">
                <div className="flex items-center gap-x-2">
                  <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0">
                    <img
                      src={stream.streamer.logo || "/placeholder.svg"}
                      alt={stream.streamer.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className={combineClasses("text-sm", textClasses.secondary)}>{stream.streamer.name}</p>
                </div>

                <div>
                  <h3 className={combineClasses("font-semibold text-lg line-clamp-1", textClasses.primary)}>
                    {stream.title}
                  </h3>
                  <div className="flex flex-wrap gap-2 mt-1">
                    <span
                      className={combineClasses("text-sm px-2 py-0.5 rounded", bgClasses.selected, textClasses.primary)}
                    >
                      {stream.location}
                    </span>
                    {stream.tags.map((tag, index) => (
                      <span
                        key={index}
                        className={combineClasses(
                          "text-sm px-2 py-0.5 rounded",
                          bgClasses.selected,
                          textClasses.primary,
                        )}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="mt-4 flex justify-center">
        {streams.length > visibleStreams ? (
          <motion.div className="w-full" whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
            <Button
              onClick={handleSeeMore}
              className={combineClasses(
                "flex items-center gap-2 w-full outline-none border-none focus:ring-0",
                buttonClasses.secondary,
              )}
            >
              See more
              <ChevronDown className="h-4 w-4" />
            </Button>
          </motion.div>
        ) : expanded ? (
          <motion.div
            className="w-full"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Button
              onClick={handleSeeLess}
              className={combineClasses(
                "flex items-center gap-2 w-full outline-none border-none focus:ring-0",
                buttonClasses.secondary,
              )}
              disabled={isCollapsing}
            >
              See less
              <ChevronUp className="h-4 w-4" />
            </Button>
          </motion.div>
        ) : null}
      </div>
    </div>
  )
}
