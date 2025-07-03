"use client";

import { useState, useEffect, useRef } from "react";
import { Eye, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence, Variants, Easing } from "framer-motion";
import { Button } from "@/components/ui/button";
import type { TrendingStreamsProps } from "@/types/explore/home";
import Image from "next/image";
import {
  textClasses,
  bgClasses,
  buttonClasses,
  combineClasses,
} from "@/lib/theme-classes";

export function TrendingStreams({ title, streams }: TrendingStreamsProps) {
  const [showAll, setShowAll] = useState(false);
  const [initialCount, setInitialCount] = useState(4);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  // Define easing functions properly
  const customEase: Easing = [0.25, 0.46, 0.45, 0.94];
  const easeInOut: Easing = "easeInOut";

  const getInitialCount = () => {
    if (typeof window === "undefined") return 4;
    if (window.innerWidth < 640) return 2; // Mobile: 2 cards
    if (window.innerWidth < 1024) return 3; // Tablet: 3 cards
    return 4; // Desktop: 4 cards
  };

  useEffect(() => {
    const count = getInitialCount();
    setInitialCount(count);

    const handleResize = () => {
      // Only update initial count if we're not showing all items
      // This prevents the component from jumping when resizing
      if (!showAll && !isTransitioning) {
        const newCount = getInitialCount();
        setInitialCount(newCount);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [showAll, isTransitioning]);

  const visibleStreams = showAll ? streams : streams.slice(0, initialCount);
  const hasMoreStreams = streams.length > initialCount;

  const containerVariants: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.08,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: {
      opacity: 0,
      y: 20,
      scale: 0.95,
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.4,
        ease: customEase, // Custom easing for smoother animation
      },
    },
    exit: {
      opacity: 0,
      y: -10,
      scale: 0.98,
      transition: {
        duration: 0.3,
        ease: easeInOut,
      },
    },
  };

  const handleToggle = async () => {
    if (isTransitioning) return; // Prevent multiple clicks during transition

    setIsTransitioning(true);

    if (showAll) {
      // When collapsing, scroll to section first
      if (sectionRef.current) {
        const rect = sectionRef.current.getBoundingClientRect();
        const scrollTop = window.pageYOffset + rect.top - 80; // Reduced offset

        window.scrollTo({
          top: scrollTop,
          behavior: "smooth",
        });

        // Wait for scroll to complete before toggling
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
      setShowAll(false);
    } else {
      // When expanding, toggle immediately
      setShowAll(true);
    }

    // Reset transition state after animation completes
    setTimeout(() => {
      setIsTransitioning(false);
    }, 500);
  };

  return (
    <div ref={sectionRef} className="w-full py-6">
      <h2
        className={combineClasses(
          "text-2xl font-bold mb-6",
          textClasses.primary,
        )}
      >
        {title}
      </h2>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-6 md:gap-y-10"
      >
        <AnimatePresence mode="wait">
          {visibleStreams.map((stream) => (
            <motion.div
              key={`${stream.id}-${showAll ? "expanded" : "collapsed"}`} // Unique key for better animations
              variants={itemVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className={`${bgClasses.card} group cursor-pointer p-2 pb-4 rounded-lg`}
            >
              <div className="relative rounded-lg overflow-hidden">
                <Image
                  width={500}
                  height={300}
                  src={stream.thumbnail || "/placeholder.svg"}
                  alt={stream.title}
                  className="w-full aspect-video object-cover transition-transform duration-300 group-hover:scale-105"
                />

                <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-0.5 text-sm rounded">
                  Live
                </div>

                <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-0.5 text-sm rounded flex items-center">
                  <Eye className="w-3 h-3 mr-1" />
                  {stream.viewCount}
                </div>
              </div>

              <div className="mt-2 flex flex-col items-start gap-2">
                <div className="flex items-center gap-x-2">
                  <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0">
                    <Image
                      width={300}
                      height={300}
                      src={stream.streamer.logo || "/placeholder.svg"}
                      alt={stream.streamer.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p
                    className={combineClasses("text-sm", textClasses.secondary)}
                  >
                    {stream.streamer.name}
                  </p>
                </div>

                <div>
                  <h3
                    className={combineClasses(
                      "font-semibold text-lg line-clamp-1",
                      textClasses.primary,
                    )}
                  >
                    {stream.title}
                  </h3>
                  <div className="flex flex-wrap gap-2 mt-1">
                    <span
                      className={combineClasses(
                        "text-sm px-2 py-0.5 rounded",
                        bgClasses.selected,
                        textClasses.primary,
                      )}
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
      </motion.div>

      {hasMoreStreams && (
        <div className="mt-6 flex justify-center">
          <motion.div
            className="w-full"
            whileHover={{ scale: isTransitioning ? 1 : 1.01 }}
            whileTap={{ scale: isTransitioning ? 1 : 0.99 }}
          >
            <Button
              onClick={handleToggle}
              disabled={isTransitioning}
              className={combineClasses(
                "flex items-center justify-center gap-2 w-full outline-none border-none focus:ring-0 transition-opacity",
                buttonClasses.secondary,
                isTransitioning
                  ? "opacity-70 cursor-not-allowed"
                  : "opacity-100",
              )}
            >
              {showAll ? "Show less" : "Show more"}
              <motion.div
                animate={{ rotate: showAll ? 180 : 0 }}
                transition={{ duration: 0.3, ease: easeInOut }}
              >
                {showAll ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </motion.div>
            </Button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
