"use client";

import type React from "react";

import { useRef, useState, useEffect } from "react";
import Image from "next/image";
import x from "../../public/Images/x.png";
import telegram from "../../public/Images/Telegram.png";
import Section from "../layout/Section";
import { Discord } from "@/public/Images";
import { motion, useInView } from "framer-motion";
import { cards } from "@/data/landing-page/community";
import { benefits } from "@/data/landing-page/benefits";
import {
  CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
} from "../ui/carousel";

const CountUp: React.FC<{ end: number; duration?: number }> = ({
  end,
  duration = 2,
}) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    let startTime: number | null = null;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = timestamp - startTime;
      const percentage = Math.min(progress / (duration * 400), 1);

      setCount(Math.floor(percentage * end));

      if (percentage < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    if (isInView) {
      animationFrame = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [end, duration, isInView]);

  return <span ref={ref}>{count}</span>;
};

// Mobile view with ShadCN carousel
const MobileCommunity = () => {
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
            {cards.map((benefit, index) => (
              <CarouselItem key={index} className="pl-1 md:pl-2 w-full ">
                <div className="h-full w-full flex items-center justify-center">
                  <div className="gradient- relative overflow-hidden w-full h-[200px] rounded-lg bg-gradient-to-r from-[#15375B] to-[#16062B] ">
                    <div className="relative p-5 sm:p-6 md:p-8 flex flex-col items-center gap-2.5 h-full">
                      <Image src={benefit.icon} alt="" className="w-14 h-14" />
                      <h3 className="text-lg font-bold text-white ">
                        {benefit.title}
                      </h3>
                      <p className="text-white/80 text-sm">
                        {benefit.description}
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
      <div className="flex items-center justify-center gap-1.5 mt-6">
        {benefits.map((_, index) => (
          <button
            key={index}
            className={` rounded-full ransition-colors duration-200 ${
              currentIndex === index
                ? "bg-blue-500 h-2.5 w-5"
                : "bg-white w-3 h-3"
            }`}
            onClick={() => carouselApi?.scrollTo(index)}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

const Community: React.FC = () => {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);
  const statsInView = useInView(statsRef, { once: true });

  // Check window size on mount and resize
  useEffect(() => {
    const checkSize = () => {
      setIsMobile(window.innerWidth < 600);
    };

    // Initial check
    checkSize();

    // Add event listener
    window.addEventListener("resize", checkSize);

    // Cleanup
    return () => window.removeEventListener("resize", checkSize);
  }, []);

  useEffect(() => {
    if (!carouselRef.current || !isMobile) return;

    const handleScroll = () => {
      const element = carouselRef.current;
      if (!element) return;

      const { scrollLeft, scrollWidth, clientWidth } = element;
      const cardWidth = scrollWidth / (cards.length * 2); // Account for duplicated cards
      const newIndex = Math.round(scrollLeft / cardWidth);
      setCurrentIndex(newIndex % cards.length);
    };

    const element = carouselRef.current;
    element.addEventListener("scroll", handleScroll);
    return () => {
      if (element) {
        element.removeEventListener("scroll", handleScroll);
      }
    };
  }, [cards.length, isMobile]);

  // Infinite scroll effect
  useEffect(() => {
    if (!carouselRef.current || !isMobile) return;

    const handleScrollEnd = () => {
      const element = carouselRef.current;
      if (!element) return;

      const { scrollLeft, scrollWidth, clientWidth } = element;

      // If we're at the end, jump to the beginning
      if (scrollLeft + clientWidth >= scrollWidth - 10) {
        // Add a small delay before jumping to make it less noticeable
        setTimeout(() => {
          if (element) {
            element.scrollTo({ left: 0, behavior: "auto" });
          }
        }, 300);
      }

      // If we're at the beginning and scrolling left, jump to the end
      if (scrollLeft <= 10) {
        const scrollToEnd = scrollWidth - clientWidth;
        setTimeout(() => {
          if (element) {
            element.scrollTo({ left: scrollToEnd, behavior: "auto" });
          }
        }, 300);
      }
    };

    const element = carouselRef.current;

    // Use scroll event instead of scrollend for better browser compatibility
    let scrollTimeout: NodeJS.Timeout;
    const handleScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(handleScrollEnd, 150);
    };

    if (element) {
      element.addEventListener("scroll", handleScroll);
    }

    return () => {
      if (element) {
        element.removeEventListener("scroll", handleScroll);
      }
      clearTimeout(scrollTimeout);
    };
  }, [isMobile]);

  return (
    <Section
      id="community"
      className="xl:px-20 md:px-14 px-5 flex flex-col items-center text-white"
    >
      <div className="text-center flex flex-col justify-center items-center gap-4 max-w-4xl w-full px-4 lg:w-2/3">
        <h1 className="text-2xl sm:text-4xl xl:text-5xl font-extrabold font-pp-neue text-white tracking-wide">
          Join Our Community - Be Part Of The Future Of Streaming
        </h1>
        <p className="text-sm sm:text-base font-normal text-white/80">
          StreamFi is more than just a platform, it&apos;s a movement. By
          joining our community, you become part of an ecosystem built for
          creators, viewers, and Web3 enthusiasts who believe in decentralized,
          creator-first streaming
        </p>
      </div>

      <div className="flex justify-center items-center text-sm gap-6 sm:gap-8 pt-10 max-w-4xl w-full px-4">
        <a
          href="https://x.com/_streamfi"
          target="_blank"
          rel="noopener noreferrer"
          className="flex justify-center gap-2 border rounded-lg px-5 py-3"
        >
          <Image
            src={x || "/placeholder.svg"}
            alt="X icon"
            width={24}
            height={22}
          />
          <p className="hidden sm:block">Join our community</p>
        </a>

        <a
          href="https://t.me/+slCXibBFWF05NDQ0"
          target="_blank"
          rel="noopener noreferrer"
          className="flex justify-center gap-2 border rounded-lg px-5 py-3"
        >
          <Image
            src={telegram || "/placeholder.svg"}
            alt="Telegram icon"
            width={24}
            height={16}
          />
          <p className="hidden sm:block">Join our community</p>
        </a>

        <a
          href="#"
          onClick={(event) => event.preventDefault()}
          className="flex justify-center gap-2 border rounded-lg px-5 py-3"
        >
          <Image src={Discord || "/placeholder.svg"} alt="Discord icon" />
          <p className="hidden sm:block">Join our community</p>
        </a>
      </div>

      <div
        ref={statsRef}
        className="grid grid-cols-2 sm:flex sm:flex-row  justify-center gap-6 lg:gap-[3rem] py-8 lg:py-20 items-center text-center"
      >
        <div>
          <p className="text-2xl lg:text-4xl font-bold font-pp-neue">
            {statsInView ? <CountUp end={25} /> : "0"}k+
          </p>
          <p className="sm:text-base text-sm">Active Members</p>
        </div>
        <div>
          <p className="text-2xl lg:text-4xl font-bold font-pp-neue">
            {statsInView ? <CountUp end={5} /> : "0"}K+
          </p>
          <p className="sm:text-base text-sm">Content Creators</p>
        </div>
        <div>
          <p className="text-2xl lg:text-4xl font-bold font-pp-neue">
            {statsInView ? <CountUp end={5} /> : "0"}K+
          </p>
          <p className="sm:text-base text-sm">Web3 Projects Integrated</p>
        </div>
        <div>
          <p className="text-2xl lg:text-4xl font-bold font-pp-neue">24/7</p>
          <p className="sm:text-base text-sm">Community Support</p>
        </div>
      </div>

      {/* Mobile and Tablet Carousel */}
      <div className="w-full">
        {/* Mobile/Tablet View */}
        {isMobile ? (
          <MobileCommunity />
        ) : (
          <div
            className={`${
              !isMobile ? "lg:flex" : "hidden"
            } lg:flex-row grid grid-cols-2 justify-center w-full gap-4 xl:gap-8 items-center text-center`}
          >
            {cards.map((card, index) => (
              <div
                key={index}
                className="flex flex-col gap-2 justify-center items-center border lg:w-56 xl:w-72 h-56 xl:h-64 px-4 rounded-lg bg-gradient-to-r from-[#15375B] to-[#16062B] border-[#2d1f3f]"
              >
                <Image
                  src={card.icon || "/placeholder.svg"}
                  alt={card.title}
                  width={50}
                  height={30}
                />
                <p className="text-xl xl:text-2xl font-bold leading-normal text-center">
                  {card.title}
                </p>
                <p className="opacity-70 xl:text-base text-sm text-center">
                  {card.description}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
};

export default Community;
