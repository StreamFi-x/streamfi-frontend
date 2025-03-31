"use client";

import React, { useState, useEffect, useRef } from "react";
import Section from "@/components/layout/Section";
import Image from "next/image";
import { useMediaQuery } from "@/hooks/use-media-query";
import { motion } from "framer-motion";
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { benefits } from "@/data/landing-page/benefits";

export const Benefits = () => {
  const [isMounted, setIsMounted] = useState(false);
  const isMobile = useMediaQuery("(max-width: 900px)");

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
    <Section
      id="benefits"
      className="relative text-white"
      wrapperClassName="bg-gradient-to-t from-transparent via-background-3 to-background-3"
    >
      {/* Section heading */}
      <motion.div
        className="mb-12 max-w-4xl"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="mb-4 font-pp-neue font-extrabold text-2xl sm:text-4xl xl:text-5xl text-white">
          Why Choose StreamFi?
        </h2>
        <p className="max-w-2xl text-white/80 text-sm sm:text-base">
          Lorem ipsum lorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem
          ipsumLorem ipsumLorem ipsumLorem ipsum ipsumLorem ipsumLorem
          ipsumLorem ipsum
        </p>
      </motion.div>

      {/* Benefits content */}
      {isMobile ? <MobileBenefitsCarousel /> : <DesktopBenefitsLayout />}
    </Section>
  );
};

// Mobile view with ShadCN carousel and auto-scroll
const MobileBenefitsCarousel = () => {
  // State for carousel API and current slide index
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll interval in milliseconds
  const autoScrollInterval = 5000;

  // Effect to handle carousel events and auto-scrolling
  useEffect(() => {
    if (!carouselApi) return;

    // Update current index when slide changes
    const onSelect = () => setCurrentIndex(carouselApi.selectedScrollSnap());

    // Register event listener
    carouselApi.on("select", onSelect);

    // Setup auto-scrolling
    const startAutoScroll = () => {
      // Clear any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      // Set new interval for auto-scrolling
      intervalRef.current = setInterval(() => {
        if (!isPaused) {
          carouselApi.scrollNext();
        }
      }, autoScrollInterval);
    };

    // Start auto-scrolling
    startAutoScroll();

    // Cleanup function
    return () => {
      carouselApi.off("select", onSelect) as unknown as void;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [carouselApi, isPaused]);

  // Handle mouse enter/leave to pause/resume auto-scrolling
  const handleMouseEnter = () => setIsPaused(true);
  const handleMouseLeave = () => setIsPaused(false);

  return (
    <motion.div
      className="w-full flex flex-col"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleMouseEnter}
      onTouchEnd={handleMouseLeave}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <div className="w-full">
        <Carousel
          opts={{
            align: "center",
            loop: true,
          }}
          className="w-full"
          setApi={setCarouselApi}
        >
          <CarouselContent className="-ml-1">
            {benefits.map((benefit, index) => (
              <CarouselItem key={index} className="pl-1 md:pl-2 w-full">
                <motion.div
                  className="h-full w-full flex items-center justify-center"
                  whileHover={{ scale: 1.02 }}
                  transition={{ duration: 0.2 }}
                >
                  <div
                    className="rounded-xl gradient-border relative overflow-hidden w-full h-[200px]"
                    style={{
                      background:
                        "linear-gradient(292.05deg, #0D0419 39.29%, #15375B 139.74%)",
                    }}
                  >
                    <div className="relative p-5 sm:p-6 md:p-8 flex flex-col gap-2.5 h-full">
                      <h3 className="mb-3 sm:mb-4 font-bold text-xl sm:text-2xl text-white">
                        {benefit.title}
                      </h3>
                      <p className="text-white/80 text-base">
                        {benefit.description
                          .split("StreamFi")
                          .map((part, i, arr) => (
                            <React.Fragment key={i}>
                              {part}
                              {i < arr.length - 1 && (
                                <span className="text-[#007BFFF5] font-medium">
                                  StreamFi
                                </span>
                              )}
                            </React.Fragment>
                          ))}
                      </p>
                    </div>
                  </div>
                </motion.div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </div>

      {/* Pagination dots */}
      <div className="flex items-center justify-center gap-2 mt-6">
        {benefits.map((_, index) => (
          <motion.button
            key={index}
            className={`w-3 h-3 rounded-full transition-colors ${
              currentIndex === index ? "bg-blue-500" : "bg-white/70"
            }`}
            onClick={() => {
              carouselApi?.scrollTo(index);
              // Pause briefly when manually selecting a slide
              setIsPaused(true);
              setTimeout(() => setIsPaused(false), 2000);
            }}
            aria-label={`Go to slide ${index + 1}`}
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.9 }}
          />
        ))}
      </div>
    </motion.div>
  );
};

// Desktop view with side-by-side images
const DesktopBenefitsLayout = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <motion.div
      className="grid grid-cols-1 sm:grid-cols-2 gap-6"
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
    >
      {benefits.map((benefit, index) => (
        <motion.div
          key={index}
          className="rounded-lg relative gradient-border overflow-hidden"
          style={{
            background:
              "linear-gradient(292.05deg, #0D0419 39.29%, #15375B 139.74%)",
          }}
          variants={itemVariants}
          transition={{ duration: 0.5 }}
          whileHover={{ scale: 1.02, y: -5 }}
        >
          {/* Content container */}
          <div className="relative p-4 sm:p-6 flex flex-col h-full sm:flex-row items-start sm:items-center gap-4">
            {/* Text content */}
            <div className="flex-1 z-10">
              <h3 className="mb-2 sm:mb-4 font-bold text-2xl sm:text-3xl text-white">
                {benefit.title}
              </h3>
              <p className="text-white/80 font-medium text-sm sm:text-base">
                {benefit.description.split("StreamFi").map((part, i, arr) => (
                  <React.Fragment key={i}>
                    {part}
                    {i < arr.length - 1 && (
                      <span className="text-[#007BFFF5] font-medium">
                        StreamFi
                      </span>
                    )}
                  </React.Fragment>
                ))}
              </p>
            </div>

            {/* Image container with responsive width */}
            {benefit.icon && (
              <div className="flex-shrink-0 sm:flex-shrink w-full sm:w-auto sm:max-w-[14rem] flex items-center justify-center">
                <div className="w-full max-w-full">
                  <div>
                    <Image
                      src={benefit.icon || "/placeholder.svg"}
                      alt={benefit.title}
                      width={224}
                      height={224}
                      className="w-full h-auto object-contain"
                      style={{ maxWidth: "100%" }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
};

export default Benefits;
