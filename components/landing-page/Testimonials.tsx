"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { useMediaQuery } from "@/hooks/use-media-query";
import Section from "@/components/layout/section";
import { testimonial_content } from "@/data/landing-page/testimonial";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";

export default function Testimonials() {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const autoplayIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Autoplay interval in milliseconds
  const autoplayDelay = 3000;

  useEffect(() => {
    if (!api) {
      return;
    }

    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap());

    api.on("select", () => {
      setCurrent(api.selectedScrollSnap());
    });

    // Setup autoplay functionality
    const startAutoplay = () => {
      // Clear any existing interval
      if (autoplayIntervalRef.current) {
        clearInterval(autoplayIntervalRef.current);
      }

      // Set new interval for auto-scrolling
      autoplayIntervalRef.current = setInterval(() => {
        if (!isPaused) {
          api.scrollNext();
        }
      }, autoplayDelay);
    };

    // Start autoplay
    startAutoplay();

    // Cleanup function
    return () => {
      if (autoplayIntervalRef.current) {
        clearInterval(autoplayIntervalRef.current);
        autoplayIntervalRef.current = null;
      }
    };
  }, [api, isPaused]);

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <Section id="testimonials" className="flex flex-col gap-8 text-white">
      <motion.header
        className="flex flex-col items-center justify-center gap-3 w-full"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        transition={{ staggerChildren: 0.2 }}
      >
        <motion.h1
          className="font-pp-neue font-extrabold text-2xl sm:text-4xl xl:text-5xl"
          variants={fadeInUp}
          transition={{ duration: 0.5 }}
        >
          Don&apos;t just take our word for it
        </motion.h1>
        <motion.p
          className="text-white/80"
          variants={fadeInUp}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          Hear from some of StreamFi amazing users
        </motion.p>
      </motion.header>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7 }}
        className="w-full"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        <Carousel
          setApi={setApi}
          className="w-full"
          opts={{
            align: "center",
            loop: true,
          }}
        >
          <CarouselContent className="-ml-2 md:-ml-8">
            {testimonial_content.map((item, idx) => (
              <CarouselItem key={idx} className="pl-2 md:pl-8 md:basis-1/3">
                <div className="overflow-hidden rounded-lg">
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    transition={{ duration: 0.3 }}
                    className="h-full w-full"
                  >
                    <Image
                      src={item.image || "/placeholder.svg"}
                      width={500}
                      height={300}
                      alt="Testimonial"
                      className="w-full h-full px-14 py-5 md:p-0 rounded-lg"
                      style={{ objectFit: "cover" }}
                    />
                  </motion.div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        {/* Pagination dots - only on mobile */}
        {isMobile && count > 0 && (
          <div className="flex justify-center gap-1 mt-4">
            {Array.from({ length: count }).map((_, index) => (
              <motion.button
                key={index}
                className={`w-2 h-2 rounded-full transition-all ${current === index ? "bg-white w-4" : "bg-white/50"}`}
                onClick={() => api?.scrollTo(index)}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        )}
      </motion.div>
    </Section>
  );
}
