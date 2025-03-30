"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Section from "@/components/layout/Section";
import { AboutImage2 } from "@/public/Images";

export default function About() {
  return (
    <Section
      id="about"
      className="relative flex flex-col gap-y-4 md:gap-y-8 text-white"
    >
      <motion.h2
        className="font-pp-neue font-extrabold text-2xl sm:text-4xl xl:text-5xl sm:text-center md:text-left"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        About StreamFi
      </motion.h2>

      <motion.div
        className="flex flex-col h-fit md:flex-row items-start gap-10"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <motion.div
          className="w-full md:w-1/2 h-auto"
          whileInView={{
            scale: [0.95, 1],
            opacity: [0.8, 1],
          }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <Image
            src={AboutImage2 || "/placeholder.svg"}
            alt="Content creator using StreamFi"
            className="w-full h-full object-cover shadow-lg"
            layout="responsive"
          />
        </motion.div>

        <motion.div
          className="hidden lg:block w-full lg:w-1/2 h-fit text-white/80 font-normal text-sm sm:text-xl text-center md:text-left"
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
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
        </motion.div>

        <motion.p
          className="block lg:hidden flex-1 text-white/80 text-sm sm:text-base text-start"
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          StreamFi is a Web3 streaming platform that empowers creators and
          gamers with full control over their earnings through instant crypto
          tipping, NFT memberships, and DeFi staking rewards. By eliminating
          middlemen, smart contracts ensure secure transactions, while DAO
          governance gives users a voice in platform decisions. <br /> Our
          mission is to create a transparent, decentralized ecosystem where
          creators earn more, engage directly with their audience, and thrive
          without restrictions.
        </motion.p>
      </motion.div>
    </Section>
  );
}
