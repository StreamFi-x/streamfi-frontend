"use client";
import Image, { StaticImageData } from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import x from "../../public/Images/x.png";
import telegram from "../../public/Images/Telegram.png";
import Section from "../layout/Section";
import { Discord } from "@/public/Images";
import { ChevronLeft, ChevronRight } from "lucide-react";

import key from "../../public/Images/key.png";
import bulb from "../../public/Images/bulb.png";
import podcast from "../../public/Images/podcast.png";
import folder from "../../public/Images/folder.png";

const cards = [
  {
    icon: key,
    title: "Exclusive Beta Access",
    description: "Be the first to try out new features",
  },
  {
    icon: bulb,
    title: "Knowledge Based & Resources",
    description: "Learn everything about Web3 streaming & monetization",
  },
  {
    icon: podcast,
    title: "Networking Opportunities",
    description: "Connect with top creators, investors and web3 pioneers",
  },
  {
    icon: folder,
    title: "Earning Potential",
    description:
      "Unlock multiple revenue streams through decentralized streaming",
  },
];

// interfaces
interface CardItem {
  icon: StaticImageData;
  title: string;
  description: string;
}

interface SlidingCarouselProps {
  items: CardItem[];
}

//  SlidingCarousel component
const SlidingCarousel = ({ items }: SlidingCarouselProps) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);
  const itemCount = items.length;

  const nextSlide = useCallback(() => {
    if (!isTransitioning) {
      setIsTransitioning(true);
      setActiveIndex((current) => (current + 1) % itemCount);
    }
  }, [itemCount, isTransitioning]);

  const prevSlide = useCallback(() => {
    if (!isTransitioning) {
      setIsTransitioning(true);
      setActiveIndex((current) => (current - 1 + itemCount) % itemCount);
    }
  }, [itemCount, isTransitioning]);

  useEffect(() => {
    const interval = setInterval(() => {
      nextSlide();
    }, 3000);
    return () => clearInterval(interval);
  }, [nextSlide]);

  useEffect(() => {
    const handleTransitionEnd = () => {
      setIsTransitioning(false);
    };

    const carousel = carouselRef.current;
    if (carousel) {
      carousel.addEventListener("transitionend", handleTransitionEnd);
      return () => {
        carousel.removeEventListener("transitionend", handleTransitionEnd);
      };
    }
  }, []);

  const goToSlide = (index: number): void => {
    if (!isTransitioning) {
      setIsTransitioning(true);
      setActiveIndex(index);
    }
  };

  return (
    <div className="w-full overflow-hidden">
      <div
        ref={carouselRef}
        className="flex transition-transform duration-500 ease-in-out"
        style={{ transform: `translateX(-${activeIndex * 100}%)` }}
      >
        {items.map((item, index) => (
          <div key={index} className="w-full flex-shrink-0">
            {/* Direct card rendering */}
            <div className="flex flex-col gap-2 justify-center items-center border w-full h-56 px-4 py-6 rounded-lg bg-gradient-to-r from-[#15375B] to-[#16062B] border-[#2d1f3f]">
              <div className="w-12 h-12 rounded-full  flex items-center justify-center mb-2">
                <Image
                  src={item.icon}
                  alt={`${item.title} icon`}
                  width={60}
                  height={24}
                />
              </div>
              <p className="text-xl font-bold leading-normal text-center text-white">
                {item.title}
              </p>
              <p className="opacity-70 text-sm text-center text-white">
                {item.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center mt-4">
        <button
          onClick={prevSlide}
          className="bg-gray-800 hover:bg-gray-700 text-white rounded-full p-2"
          aria-label="Previous slide"
        >
          <ChevronLeft size={16} />
        </button>

        <div className="flex justify-center gap-2">
          {items.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                index === activeIndex ? "bg-blue-500" : "bg-white"
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>

        <button
          onClick={nextSlide}
          className="bg-gray-800 hover:bg-gray-700 text-white rounded-full p-2"
          aria-label="Next slide"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

const Community = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkIfMobile();
    window.addEventListener("resize", checkIfMobile);
    return () => window.removeEventListener("resize", checkIfMobile);
  }, []);

  return (
    <Section id="community" className="pt-20 flex flex-col items-center">
      <div className="text-start md:text-center flex flex-col justify-center items-center gap-4 md:max-w-4xl md:w-2/3">
        <h1 className="text-[23px] md:text-5xl font-extrabold text-offWhite tracking-wide font-helvetica">
          Join Our Community - Be Part Of The Future Of Streaming
        </h1>
        <p className="opacity-60 text-base font-normal text-white/80">
          StreamFi is more than just a platform, it&apos;s a movement. By
          joining our community, you become part of an ecosystem built for
          creators, viewers, and Web3 enthusiasts who believe in decentralized,
          creator-first streaming
        </p>
      </div>

      {/* community social handle */}
      <div className="flex justify-center items-center gap-6 sm:gap-8 pt-10 max-w-4xl w-full">
        <button className="flex justify-center gap-2 border rounded-lg px-5 py-3">
          <Image src={x} alt="X icon" width={24} height={18} />
          <p className="hidden md:block">Join our community</p>
        </button>
        <button className="flex justify-center gap-2 border rounded-lg px-5 py-3">
          <Image src={telegram} alt="telegram icon" width={24} height={18} />
          <p className="hidden md:block">Join our community</p>
        </button>
        <button className="flex justify-center gap-2 border rounded-lg px-5 py-3">
          <Image src={Discord} alt="Discord icon" width={24} height={24} />
          <p className="hidden md:block">Join our community</p>
        </button>
      </div>

      {/* Stats: numbers of Active members etc. */}
      <div className="sm:flex grid grid-cols-2 justify-center gap-[1.5rem] md:gap-[3.5rem] py-20 items-center text-center">
        <div>
          <p className="text-4xl font-bold font-helvetica">25k+</p>
          <p className="text-[11px] md:text-xl opacity-45 ">Active Members</p>
        </div>
        <div>
          <p className="text-4xl font-bold font-helvetica">5K+</p>
          <p className="text-[11px] md:text-xl opacity-45 ">Content Creators</p>
        </div>
        <div>
          <p className="text-4xl font-bold font-helvetica">5K+</p>
          <p className="text-[11px] md:text-xl opacity-45 ">
            Web3 Projects Integrated
          </p>
        </div>
        <div>
          <p className="text-4xl font-bold font-helvetica">24/7</p>
          <p className="text-[11px] md:text-xl opacity-45 ">
            Community Support
          </p>
        </div>
      </div>

      {/* Community Cards-benefits Desktop view */}
      {!isMobile && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 xl:gap-8 items-center text-center">
          {cards.map((card, index) => (
            <div
              key={index}
              className="flex flex-col gap-2 justify-center items-center border w-56 xl:w-72 h-56 xl:h-64 px-4 rounded-lg bg-gradient-to-r from-[#15375B] to-[#16062B] border-[#2d1f3f]"
            >
              <div className="w-24 h-24 rounded-full  flex items-center justify-center mb-2">
                <Image
                  src={card.icon}
                  alt={`${card.title} icon`}
                  width={60}
                  height={24}
                />
              </div>
              {/* <p className="text-xl xl:text-2xl font-bold leading-normal text-center text-white">
                {card.title}
              </p> */}
              <p className="opacity-70 xl:text-base text-sm text-center text-white">
                {card.description}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Cards Section - Mobile View with Sliding Carousel */}
      {isMobile && (
        <div className="w-full max-w-md mt-4">
          <SlidingCarousel items={cards} />
        </div>
      )}
    </Section>
  );
};

export default Community;
