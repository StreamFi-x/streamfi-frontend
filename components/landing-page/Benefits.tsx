import React from "react";
import Section from "../layout/Section";
import Image from "next/image";
import { CommunityIcon, MoneyLink } from "@/public/icons";

export const Benefits = () => {
  return (
    <Section className="relative pt-24 pb-11 text-white ">
      <div
        className="absolute -top-10 left-0 w-full h-16"
        style={{
          background: "linear-gradient(to top, transparent 100%, #17181F 30%)",
        }}
      />
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 md:flex flex-col gap-6">
        {/* Decentralized Monetization */}
        <div className="flex gap-5">
          <div
            className="w-3/5 p-6 rounded-lg flex justify-between gap-4 gradient-border relative overflow-hidden h-80"
            style={{
              background:
                "linear-gradient(292.05deg, #0D0419 39.29%, #15375B 139.74%)",
            }}
          >
            <div className="mt-auto z-10 ">
              <h3 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Decentralized Monetization
              </h3>
              <p className="text-white/80 font-medium text-base">
                No middlemen. You keep 100% of your earnings.{" "}
                <span className="text-[#007BFFF5] font-medium">StreamFi</span>{" "}
                enables direct, peer-to-peer transactions, ensuring creators
                receive 100% of tips and earnings with no corporate cuts.
              </p>
            </div>
            <Image src={MoneyLink} alt="" className="animate-pulse"/>
          </div>
          {/* Ad-Free Experience */}
          <div
            className="w-2/5 p-6 rounded-lg flex flex-col  gradient-border justify-between relative overflow-hidden h-80"
            style={{
              background:
                "linear-gradient(291.43deg, #16062B 24.87%, #15375B 137.87%)",
            }}
          >
    
            <div className="mt-auto z-10 w-[85%]">
              <h3 className="text-3xl md:text-4xl font-semibold mb-4">
                Ad-Free Experience
              </h3>
              <p className="text-white/80 text-base">
                Enjoy uninterrupted, high-quality streaming.{" "}
                <span className="text-[#007BFFF5]">StreamFi</span> offers an
                ad-free environment where creators monetize directly through
                subscriptions, tips, and staking, not ads.
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-5">
          {/* Direct Fan Engagement */}
          <div
            className="w-2/5 p-6 rounded-lg flex flex-col gradient-border justify-between relative overflow-hidden h-80"
            style={{
              background:
                "linear-gradient(291.43deg, #16062B 24.87%, #15375B 137.87%)",
            }}
          >
            <div className="mt-auto z-10 w-[85%]">
              <h3 className="text-3xl text-nowrap md:text-4xl font-semibold mb-4">
                Direct Fan Engagement
              </h3>
              <p className="text-white/80 text-base">
                Build stronger communities with direct interactions. With
                traditional platforms, fans are just viewers; on{" "}
                <span className="text-[#007BFFF5]">StreamFi</span>, theyre active
                supporters.
              </p>
            </div>
          </div>
          {/* Community-Driven Governance */}
          <div
            className="w-3/5 p-6 gradient-border rounded-lg flex justify-between relative overflow-hidden h-80"
            style={{
              background:
                "linear-gradient(291.43deg, #16062B 24.87%, #15375B 137.87%)",
            }}
          >
            <div className="mt-auto  z-10">
              <h3 className="text-3xl sm:text-4xl font-semibold mb-4">
                Community-Driven Governance
              </h3>
              <p className="text-white/80 text-base">
                Have a say in the future of{" "}
                <span className="text-[#007BFFF5]">StreamFi</span>. Unlike
                centralized platforms where policy changes hurt creators (e.g.,
                demonetization), StreamFi is community-owned.
              </p>
            </div>
            <Image src={CommunityIcon} alt="" className="animate-pulse " />
          </div>
        </div>
      </div>
    </Section>
  );
};

export default Benefits;
