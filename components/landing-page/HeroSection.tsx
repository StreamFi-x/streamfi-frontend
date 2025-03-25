"use client";

import Image from "next/image";
import React from "react";
import "@fontsource/inter";
import { CoinbaseLogo, StripeLogo, YoutubeLogo } from "@/public/Images";
import LogoDesktop from "@/public/Images/hero-image-streamfi.png";
import Hero2 from "@/public/Images/hero2.svg";
import Link from "next/link"; 

const HeroSection: React.FC = () => {
  return (
    <div className="overflow-hidden relative pt-[3em] lg:pt-0">
      <div className="w-full  2xl:max-w-[3000px]    lg:pl-12 xl:pl-20  relative">
        <div className="flex  items-center flex-col lg:flex-row mt-16 md:mt-24 lg:mt-32">
          <div className="flex flex-col w-full">
            <div className="w-full h-full md:pr-8 lg:pr-1 xl:w-[35.8em]  space-y-2.5 px-[1em] lg:px-0">
              <h1
                className="text-3xl sm:text-4xl text-center lg:text-left lg:text-4xl text-white font-extrabold leading-tight mb-4 sm:mb-6  "
                style={{ fontFamily: "PP Neue Machina" }}
              >
                Own Your Stream. Own Your Earnings
              </h1>
              <p
                className="text-white/80 text-base sm:mb-4 max-w-xl hidden lg:block"
                style={{ fontFamily: "Inter" }}
              >
                Stream without limits, engage your community, and earn instantly
                with a blockchain-powered ecosystem that ensures true ownership,
                decentralized rewards, and frictionless transactions. Built for
                creators, powered by Web3, and designed for the future of
                streaming.
              </p>
              <p className="text-center text-white text-[19px] font-medium lg:hidden ">
                Stream, engage, and earn instantly with blockchain-powered ownership and decentralized rewards.
              </p>
              <div className="flex flex-col justify-center lg:justify-start pt-4 sm:flex-row space-y-4 sm:space-y-0 sm:space-x-3 ">
                <Link href="/explore">
                  <button
                    className="bg-primary text-white px-[20px] py-[12px] rounded-lg font-medium w-full sm:w-auto"
                    style={{ fontFamily: "Inter" }}
                  >
                    Explore Streams
                  </button>
                </Link>
                <button
                  className="text-white px-4 py-3 rounded-lg font-medium bg-white/10"
                  style={{ fontFamily: "Inter" }}
                >
                  Launch Your Stream
                </button>
              </div>
            </div>
            {/* Logos */}
            <div className="flex  justify-center lg:justify-start items-center gap-8 md:space-x-8 pb-10 xl:pb-20 mt-[4em] px-[2em]">
              <Image
                src={StripeLogo}
                alt="Stripe"
                className="opacity-100  md:h-auto  lg:w-13 md:w-auto"
              />
              <Image
                src={YoutubeLogo}
                alt="YouTube"
                className="opacity-100 h-6 md:h-auto w-[4.5em] lg:w-13 md:w-suto"
              />
              <Image
                src={CoinbaseLogo}
                alt="Coinbase"
                className="opacity-100 h-6 md:h-auto w-[4.5em] lg:w-13 md:w-suto"
              />
            </div>
          </div>

          <div className="relative w-full xl:w-[180em] lg:w-[120em] lg:mr-[-15em] xl:mr-[-20em] h-full  lg:mt-2 mt-9">
            <Image
              src={LogoDesktop}
              alt="Streaming App Interface"
              width={900}
              height={1000}
              className="lg:h-full lg:w-full hidden lg:block "
            />
            <Image
              src={Hero2}
              alt="Gradient"
              width={1000}
              height={1000}
              className="  w-full lg:hidden"
            />
            <div
              className="absolute w-full bottom-0 left-0 right-0 h-16"
              style={{
                background:
                  "linear-gradient(to top, #17181F 0%, transparent 100%)",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroSection;