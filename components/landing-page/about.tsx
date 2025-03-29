import Section from "@/components/layout/Section";
import { AboutImage, AboutImage2 } from "@/public/Images";
// import { AboutImage } from "@/public/images";
import Image from "next/image";

export default function About() {
  return (
    <Section
      id="about"
      className=" flex flex-col gap-y-4 md:gap-y-8 relative py-8 sm:py-20  container  mx-auto text-white"
    >
      <h2 className="text-2xl sm:text-4xl xl:text-5xl font-extrabold font-pp-neue sm:text-center md:text-left">
        About StreamFi
      </h2>
      <div className="flex flex-col h-fit md:flex-row items-start xl:items-center gap-6 md:gap-4">
        <div className="w-full h-full md:w-1/2 ">
          <Image
            src={AboutImage}
            alt="Content creator using StreamFi"
            className="sm:block hidden shadow-lg h-[260px]"
            height={400}
          />
          <Image
            src={AboutImage2}
            alt="Content creator using StreamFi"
            className="block sm:hidden shadow-lg "
            height={300}
          />
        </div>

        <div className="hidden sm:block w-full md:w-1/2 font-normal text-center h-fit md:text-left text-sm sm:text-base text-white/80">
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
        <p className="text-start block sm:hidden text-sm sm:text-base text-white/80">
          StreamFi is a Web3 streaming platform that empowers creators and
          gamers with full control over their earnings through instant crypto
          tipping, NFT memberships, and DeFi staking rewards. By eliminating
          middlemen, smart contracts ensure secure transactions, while DAO
          governance gives users a voice in platform decisions. <br /> Our
          mission is to create a transparent, decentralized ecosystem where
          creators earn more, engage directly with their audience, and thrive
          without restrictions.
        </p>
      </div>
    </Section>
  );
}
