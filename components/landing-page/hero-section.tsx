"use client";

import Image from "next/image";
import type React from "react";
import "@fontsource/inter";
import { CoinbaseLogo, StripeLogo, YoutubeLogo } from "@/public/Images";
import LogoDesktop from "@/public/Images/hero-image-streamfi.png";
import Section from "@/components/layout/Section";
import Link from "next/link";

const HeroSection: React.FC = () => {
  return (
    <Section
      id="hero"
      wrapperClassName="bg-gradient-to-b from-transparent via-transparent to-background-3"
    >
      <div className="relative overflow-hidden text-white">
        <div className="relative w-full">
          <div className="flex flex-col lg:flex-row items-start">
            <div className="flex flex-col w-full">
              <div className="w-full h-full space-y-2.5 px-[1em] lg:px-0 md:pr-8 lg:pr-1 xl:w-[35.8em]">
                <h1 className="font-pp-neue font-extrabold text-3xl sm:text-4xl lg:text-4xl text-white text-center lg:text-left leading-tight mb-4 sm:mb-6 lg:pt-10">
                  Own Your Stream. Own Your Earnings
                </h1>
                <p
                  className="text-white/80 text-base sm:mb-4 max-w-xl hidden lg:block"
                  style={{ fontFamily: "Inter" }}
                >
                  Stream without limits, engage your community, and earn
                  instantly with a blockchain-powered ecosystem that ensures
                  true ownership, decentralized rewards, and frictionless
                  transactions. Built for creators, powered by Web3, and
                  designed for the future of streaming.
                </p>
                <p className="text-white text-[19px] font-medium text-center lg:hidden">
                  Stream, engage, and earn instantly with blockchain-powered
                  ownership and decentralized rewards.
                </p>
                <div className="flex flex-col sm:flex-row justify-center lg:justify-start pt-4 space-y-4 sm:space-y-0 sm:space-x-3">
                  <Link href={"/explore"}>
                    <button
                      className="bg-white/10 hover:bg-gray-800 duration-300 text-white px-4 py-3 rounded-lg font-medium"
                      style={{ fontFamily: "Inter" }}
                    >
                      Launch Your Stream
                    </button>
                  </Link>
                </div>
              </div>
              {/* Logos */}
              <div className="flex justify-center lg:justify-start items-center gap-8 md:space-x-8 mt-[4em] px-[2em] pb-10 xl:pb-20">
                <Image
                  src={StripeLogo || "/placeholder.svg"}
                  alt="Stripe"
                  className="opacity-100 md:h-auto lg:w-13 md:w-auto"
                />
                <Image
                  src={YoutubeLogo || "/placeholder.svg"}
                  alt="YouTube"
                  className="opacity-100 h-6 md:h-auto w-[4.5em] lg:w-13 md:w-suto"
                />
                <Image
                  src={CoinbaseLogo || "/placeholder.svg"}
                  alt="Coinbase"
                  className="opacity-100 h-6 md:h-auto w-[4.5em] lg:w-13 md:w-suto"
                />
              </div>
            </div>

            <div className="relative w-full xl:w-[180em] lg:w-[120em] lg:mr-[-15em] xl:mr-[-20em] h-full lg:mt-2 mt-9">
              <Image
                src={LogoDesktop || "/placeholder.svg"}
                alt="Streaming App Interface"
                width={900}
                height={1000}
                className="h-full w-full block"
              />
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
};

export default HeroSection;
