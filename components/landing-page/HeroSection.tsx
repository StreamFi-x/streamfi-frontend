"use client";

import Image from "next/image";
import React from "react";
import "@fontsource/inter";
import { CoinbaseLogo, StripeLogo, YoutubeLogo } from "@/public/Images";
import LogoDesktop from "@/public/Images/hero-image-streamfi.png";
import Hero2 from "@/public/Images/hero2.svg";
import Button from "../ui/Button";
import Section from "../layout/Section";

const HeroSection: React.FC = () => {
  return (
    <Section
      id="hero"
      wrapperClassName="bg-gradient-to-b from-transparent via-transparent to-background-2"
    >
      <div className="overflow-hidden  relative  text-white">
        <div className="w-full   relative">
          <div className="flex  items-start flex-col lg:flex-row ">
            <div className="flex flex-col w-full">
              <div className="w-full h-full md:pr-8 lg:pr-1 xl:w-[35.8em]  space-y-2.5 px-[1em] lg:px-0">
                <h1
                  className="text-3xl sm:text-4xl text-center lg:text-left lg:text-4xl text-white font-extrabold leading-tight mb-4 sm:mb-6 lg:pt-10 "
                  style={{ fontFamily: "PP Neue Machina" }}
                >
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
                <p className="text-center text-white text-[19px] font-medium lg:hidden ">
                  Stream, engage, and earn instantly with blockchain-powered
                  ownership and decentralized rewards.
                </p>
                <div className="flex flex-col justify-center lg:justify-start pt-4 sm:flex-row space-y-4 sm:space-y-0 sm:space-x-3 ">
                  <Button
                    className="bg-primary text-base hover:bg-primary/60 duration-300 text-white px-[20px] py-[12px] rounded-lg font-medium w-full sm:w-auto"
                    isLink
                    href="/explore"
                  >
                    Explore Streams
                  </Button>
                  <button
                    className="text-white px-4 py-3 rounded-lg font-medium bg-white/10 hover:bg-gray-800 duration-300"
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
                className="h-full w-full block "
              />
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
};

export default HeroSection;
