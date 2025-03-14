"use client";

import Image from "next/image";
import React from "react";
import "@fontsource/inter";
import { CoinbaseLogo, StripeLogo, YoutubeLogo } from "@/public/Images";

const HeroSection: React.FC = () => {
  return (
    <>
      <div className="w-full max-w-[1440px] 2xl:max-w-[3000px] mx-aut pl-8 sm:pl-6 lg:pl-12 xl:pl-20 overflow-hidden relative">
        <div className="flex flex-col md:flex-row mt-16 md:mt-24 lg:mt-32">
          <div className="flex flex-col w-full">
            <div className="w-full h-full md:pr-8 lg:pr-1 pt-2 xl:pt-12 space-y-2.5">
              <h1
                className="text-3xl sm:text-4xl lg:text-5xl text-white font-extrabold leading-tight mb-4 sm:mb-6  "
                style={{ fontFamily: "PP Neue Machina" }}
              >
                Own Your Stream. Own Your Earnings
              </h1>
              <p
                className="text-white/80 text-base sm:mb-4 max-w-xl"
                style={{ fontFamily: "Inter" }}
              >
                Stream without limits, engage your community, and earn instantly
                with a blockchain-powered ecosystem that ensures true ownership,
                decentralized rewards, and frictionless transactions. Built for
                creators, powered by Web3, and designed for the future of
                streaming.
              </p>
              <div className="flex flex-col pt-4 sm:flex-row space-y-4 sm:space-y-0 sm:space-x-3">
                <button
                  className="bg-primary text-white px-[20px] py-[12px] rounded-lg font-medium"
                  style={{ fontFamily: "Inter" }}
                >
                  Explore Streams
                </button>
                <button
                  className="text-white px-4 py-3 rounded-lg font-medium bg-white/10"
                  style={{ fontFamily: "Inter" }}
                >
                  Launch Your Stream
                </button>
              </div>
            </div>
            {/* Logos */}
            <div className="flex  justify-center md:justify-start items-center gap-8 md:space-x-8 pb-10 xl:pb-20">
              <Image
                src={StripeLogo}
                alt="Stripe"
                className="opacity-100 h-6 md:h-auto"
              />
              <Image
                src={YoutubeLogo}
                alt="YouTube"
                className="opacity-100 h-6 md:h-auto"
              />
              <Image
                src={CoinbaseLogo}
                alt="Coinbase"
                className="opacity-100 h-6 md:h-auto"
              />
            </div>
          </div>

          <div className="relative w-full ">
            <img
              src={"/images/Stream-Fi.png"}
              alt="Streaming App Interface"
              width={991}
              height={816}
              className=" "
            />
            <div
              className="absolute bottom-0 left-0 right-0 h-16"
              style={{
                background:
                  "linear-gradient(to top, #17181F 0%, transparent 100%)",
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default HeroSection;
