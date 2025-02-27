"use client";

import Image from "next/image";
import React from 'react';
import "@fontsource/inter"; 

const HeroSection: React.FC = () => {
  return (
    <>

      <div className="w-full max-w-[1440px] mx-auto px-8 sm:px-6 md:px-8 overflow-hidden relative">
        {/* Main Content */}
        <div className="flex flex-col md:flex-row mt-16 md:mt-24 lg:mt-32">
          {/* Left Column */}
          <div className="w-full md:w-3/5 lg:w-1/2 md:pr-8 lg:pr-12 pt-6 md:pt-12">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl text-white font-bold leading-tight mb-4 sm:mb-6" style={{ fontFamily: 'PP Neue Machina' }} >
              Own Your Stream. Own Your Earnings
            </h1>
            <p className="text-gray-400 text-xs sm:text-sm mb-6 sm:mb-8 max-w-xl" style={{ fontFamily: 'Inter' }} >
              Stream without limits, engage your community, and earn instantly with a
              blockchain-powered ecosystem that ensures true ownership, decentralized
              rewards, and frictionless transactions. Built for creators, powered by Web3, and
              designed for the future of streaming.
            </p>
            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
              <button className="bg-[#5A189A] text-white px-[20px] py-[12px] rounded-lg font-medium" style={{ fontFamily: 'Inter' }}>
                Explore Streams
              </button>
              <button className="text-white px-8 py-3 rounded-lg font-medium bg-white/10" style={{ fontFamily: 'Inter' }}>
                Launch Your Stream
              </button>
            </div>
          </div>
        </div>


        {/* Logos */}
        <div className="flex flex-wrap justify-center md:justify-start items-center gap-8 md:space-x-8 lg:space-x-12 mt-[160px] md:mt-[200px] lg:mt-[260px] z-0">
          <img src="/images/stripe-logo.png" alt="Stripe" className="opacity-100 h-6 md:h-auto" />
          <img src="/images/youtube-logo.png" alt="YouTube" className="opacity-100 h-6 md:h-auto" />
          <img src="/images/coinbase-logo.png" alt="Coinbase" className="opacity-100 h-6 md:h-auto" />
        </div>

      </div>
      <img
        src="/images/Stream-Fi.png"
        alt="Streaming App Interface"
        width={991}
        height={816}
        className="absolute top-[250px] sm:top-[200px] md:top-[180px] lg:top-[150px] right-0 object-contain w-[80%] sm:w-[60%] md:w-[55%] lg:max-w-[50%]"
      />
      <div
        className="absolute top-[400px] sm:top-[500px] md:top-[712px] lg:top-[613px] left-0 w-full h-64"
        style={{
          background: "linear-gradient(to top, #17181F 1%, transparent 100%)",
        }}
      />
    </>
  );
};

export default HeroSection;
