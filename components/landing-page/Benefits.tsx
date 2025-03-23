"use client";

import React, { useState, useEffect } from "react";
import Section from "../layout/Section";
import Image from "next/image";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "@/components/ui/carousel";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
    <Section className="relative pt-24 pb-11 text-white">
      {/* Gradient overlay */}
      <div
        className="absolute -top-10 left-0 w-full h-16"
        style={{
          background: "linear-gradient(to top, transparent 100%, #17181F 30%)",
        }}
      />

      {/* Section heading */}
      <div className="mb-12 max-w-3xl">
        <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
          Why Choose StreamFi?
        </h2>
        <p className="text-white/80 font-normal max-w-2xl">
          Lorem ipsum lorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem
          ipsumLorem ipsumLorem ipsumLorem ipsum ipsumLorem ipsumLorem
          ipsumLorem ipsum
        </p>
      </div>

      {/* Benefits content */}
      {isMobile ? <MobileBenefitsCarousel /> : <DesktopBenefitsLayout />}
    </Section>
  );
};

// Mobile view with ShadCN carousel
const MobileBenefitsCarousel = () => {
  // Custom hook to detect extra small screens
  const isExtraSmall = useMediaQuery("(max-width: 480px)");

  return (
    <div className="w-full">
      <Carousel
        opts={{
          align: "center",
          loop: true,
        }}
        className="w-full"
      >
        <CarouselContent>
          {benefits.map((benefit, index) => (
            <CarouselItem key={index} className="pl-1 basis-full">
              {/* Card container with fixed height for consistency */}
              <div
                className="rounded-lg relative gradient-border overflow-hidden"
                style={{
                  background:
                    "linear-gradient(292.05deg, #0D0419 39.29%, #15375B 139.74%)",
                  height: "400px", // Fixed height ensures all cards are the same size
                }}
              >
                {/* Content container - using flex with justify-center for vertical alignment */}
                <div className="relative p-4 sm:p-6 flex flex-col h-full justify-center">
                  {/* Image container at the top with responsive width */}
                  {benefit.icon && (
                    <div
                      className="flex items-center justify-center mb-2 sm:mb-4"
                      style={{
                        maxWidth: isExtraSmall ? "8rem" : "12rem", // Smaller image on extra small screens
                        margin: "0 auto",
                      }}
                    >
                      <Image
                        src={benefit.icon || "/placeholder.svg"}
                        alt={benefit.title}
                        width={isExtraSmall ? 128 : 192} // Smaller dimensions on extra small screens
                        height={isExtraSmall ? 128 : 192}
                        className="w-auto h-auto max-w-full object-contain animate-pulse"
                      />
                    </div>
                  )}

                  {/* Text content - centered horizontally with text-center */}
                  <div className="z-10 w-full text-center">
                    <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 sm:mb-4">
                      {benefit.title}
                    </h3>
                    <p className="text-white/80 font-medium text-sm sm:text-base line-clamp-6 sm:line-clamp-none">
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
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        {/* Carousel navigation controls */}
        <div className="flex justify-center mt-6">
          <CarouselPrevious className="mr-2 bg-transparent border-blue-500/30 text-blue-400 hover:bg-blue-900/20">
            <ChevronLeft className="h-4 w-4" />
          </CarouselPrevious>
          <CarouselNext className="ml-2 bg-transparent border-blue-500/30 text-blue-400 hover:bg-blue-900/20">
            <ChevronRight className="h-4 w-4" />
          </CarouselNext>
        </div>
      </Carousel>
    </div>
  );
};

// Desktop view with side-by-side images
const DesktopBenefitsLayout = () => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      {benefits.map((benefit, index) => (
        <div
          key={index}
          className="rounded-lg relative gradient-border overflow-hidden"
          style={{
            background:
              "linear-gradient(292.05deg, #0D0419 39.29%, #15375B 139.74%)",
          }}
        >
          {/* Content container */}
          <div className="relative p-4 sm:p-6 flex flex-col h-full sm:flex-row items-start sm:items-center gap-4">
            {/* Text content */}
            <div className="flex-1 z-10">
              <h3 className="text-2xl sm:text-3xl font-bold text-white mb-2 sm:mb-4">
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
                  <Image
                    src={benefit.icon || "/placeholder.svg"}
                    alt={benefit.title}
                    width={224}
                    height={224}
                    className="w-full h-auto object-contain animate-pulse"
                    style={{ maxWidth: "100%" }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default Benefits;
