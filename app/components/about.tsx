import Section from "@/components/Section";
import { AboutImage } from "@/public/Images";
import Image from "next/image";

export default function About() {
  return (
    <Section
      id="about"
      className="pb-12.5 pt-8.5 flex flex-col gap-y-4 md:gap-y-8 mt-14 mx-auto"
    >
      <h2 className="text-4xl md:text-5xl font-bold  text-center md:text-left">
        About StreamFi
      </h2>
      <div className="flex flex-col md:flex-row items-start xl:items-center gap-6 md:gap-4">
        <div className="w-full md:w-1/2 ">
          <Image
            src={AboutImage}
            alt="Content creator using StreamFi"
            width={600}
            height={400}
            className=" shadow-lg"
          />
        </div>

        <div className="w-full md:w-1/2 text-center md:text-left">
          <p className="mb-4">
            StreamFi is a Web3-powered streaming platform built to give content
            creators and gamers full control over their earnings. Unlike
            traditional platforms that take large cuts and delay payouts,
            StreamFi uses blockchain technology to enable instant crypto
            tipping, NFT-based memberships, and DeFi staking rewards—all without
            middlemen.
          </p>
          <p>
            Our mission is to redefine content monetization by offering a
            transparent, decentralized, and community-driven ecosystem. With
            smart contracts ensuring secure transactions and DAO governance
            giving users a say in platform decisions, StreamFi is creating a
            future where creators earn more, engage directly with their
            audience, and thrive without restrictions.
          </p>
        </div>
      </div>
    </Section>
  );
}
