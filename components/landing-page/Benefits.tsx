"use client";

import React, { useState, useEffect } from "react";
import Section from "../layout/Section";
import Image from "next/image";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  Carousel,
  CarouselApi,
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
      wrapperClassName="bg-gradient-to-t from-transparent via-background-2 to-background-2"
    >
      {/* Gradient overlay */}

      <div
        className="absolute -top-10 left-0 w-full h-16"
        style={{
          background: "linear-gradient(to top, transparent 100%, #17181F 30%)",
        }}
      />

      {/* Section heading */}
      <div className="mb-12 max-w-4xl">
        <h2 className="text-2xl sm:text-4xl xl:text-5xl font-extrabold font-pp-neue text-white mb-4">
          Why Choose StreamFi?
        </h2>
        <p className="text-sm sm:text-base text-white/80 max-w-2xl">
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
  // State for carousel API and current slide index
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Effect to handle carousel events
  useEffect(() => {
    if (!carouselApi) return;

    // Update current index when slide changes
    const onSelect = () => setCurrentIndex(carouselApi.selectedScrollSnap());

    // Register and cleanup event listener
    carouselApi.on("select", onSelect);
    return () => {
      carouselApi.off("select", onSelect) as unknown as void;
    };
  }, [carouselApi]);

  return (
    <div className="w-full flex flex-col">
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
              <CarouselItem key={index} className="pl-1 md:pl-2 w-full ">
                <div className="h-full w-full flex items-center justify-center">
                  <div
                    className="rounded-xl gradient-border relative overflow-hidden w-full h-[200px]"
                    style={{
                      background:
                        "linear-gradient(292.05deg, #0D0419 39.29%, #15375B 139.74%)",
                    }}
                  >
                    <div className="relative p-5 sm:p-6 md:p-8 flex flex-col gap-2.5 h-full">
                      <h3 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">
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
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </div>

      {/* Pagination dots */}
      <div className="flex items-center justify-center gap-2 mt-6">
        {benefits.map((_, index) => (
          <button
            key={index}
            className={`w-3 h-3 rounded-full transition-colors ${
              currentIndex === index ? "bg-blue-500" : "bg-white"
            }`}
            onClick={() => carouselApi?.scrollTo(index)}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
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
