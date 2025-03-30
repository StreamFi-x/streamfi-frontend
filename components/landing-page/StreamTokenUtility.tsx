"use client";
import Image from "next/image";
import { motion } from "framer-motion";
import { tokenUtilityData } from "@/data/landing-page/streamTokenUtility";
import Section from "../layout/Section";

const vpnKey = "/Images/vpn_key.svg";
const token1 = "/Images/tokens/token1.svg";
const token2 = "/Images/tokens/token2.svg";
const token3 = "/Images/tokens/token3.svg";
const token4 = "/Images/tokens/token4.svg";
const token5 = "/Images/tokens/token4.svg";

export default function StreamTokenUtility() {
  // Animation variants
  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  const staggerChildren = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
      },
    },
  };

  const floatAnimation = {
    initial: { y: 0 },
    animate: {
      y: [0, -10, 0],
      transition: {
        duration: 3,
        repeat: Infinity,
        repeatType: "reverse" as const,
        ease: "easeInOut",
      },
    },
  };

  return (
    <Section
      id="stream-token-utility"
      className="relative grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-8  bg-transparent overflow-hidden"
    >
      {/* Content Container */}
      <div className="col-span-1 md:col-span-2 flex flex-col items-center gap-6 relative z-40">
        <motion.h1
          className="text-2xl sm:text-4xl xl:text-5xl font-extrabold font-pp-neue text-white text-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeInUp}
          transition={{ duration: 0.5 }}
        >
          $Stream Token Utility
        </motion.h1>

        <motion.p
          className=" text-sm sm:text-base text-white/80 font-normal sm:text-center max-w-[844px]"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeInUp}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          Lorem ipsum dolor sit amet consectetur. Dictum elementum malesuada sed
          a. Cursus sem pellentesque porttitor fringilla consectetur egestas
        </motion.p>
      </div>

      {/* Cards Container */}

      {/* Token images with animations - responsive positioning */}
      <motion.div>
        <motion.div
          className="absolute  top-[60%] left-[5%] md:left-[14%] hidden md:flex items-center justify-center w-[150px] h-[120px] md:w-[449.8px] md:h-[304.2px] z-0"
          variants={floatAnimation}
          initial="initial"
          animate="animate"
        >
          <Image
            src={token1}
            alt="token1"
            height={100}
            width={100}
            className="object-cover h-[304px] w-[340px]"
          />
        </motion.div>

        <motion.div
          className="absolute top-[45%] left-[2%] md:left-[7%] hidden md:flex items-center justify-center w-[100px] h-[80px] md:w-[306px] md:h-[206px] blur-[2px]"
          variants={floatAnimation}
          initial="initial"
          animate="animate"
          transition={{ delay: 0.5 }}
        >
          <Image
            src={token2}
            alt="token2"
            height={100}
            width={100}
            className="object-cover h-full w-full"
          />
        </motion.div>

        <motion.div
          className="absolute top-[30%] left-[15%] md:left-[28%] hidden md:flex items-center justify-center w-[80px] h-[60px] md:w-[204px] md:h-[138px] blur-[3px]"
          variants={floatAnimation}
          initial="initial"
          animate="animate"
          transition={{ delay: 1 }}
        >
          <Image
            src={token3}
            alt="token3"
            height={100}
            width={100}
            className="object-cover h-full w-full"
          />
        </motion.div>

        <motion.div
          className="absolute top-[25%] left-[0%] md:left-[3%] hidden md:flex items-center justify-center w-[90px] h-[70px] md:w-[204px] md:h-[138px] blur-[2px]"
          variants={floatAnimation}
          initial="initial"
          animate="animate"
          transition={{ delay: 1.5 }}
        >
          <Image
            src={token4}
            alt="token4"
            height={100}
            width={100}
            className="object-cover h-full w-full"
          />
        </motion.div>

        <motion.div
          className="absolute top-[10%] left-[8%] md:left-[13%] hidden md:flex items-center justify-center w-[90px] h-[70px] md:w-[204px] md:h-[138px] blur-[2px]"
          variants={floatAnimation}
          initial="initial"
          animate="animate"
          transition={{ delay: 2 }}
        >
          <Image
            src={token5}
            alt="token5"
            height={100}
            width={100}
            className="object-cover h-full w-full"
          />
        </motion.div>
      </motion.div>
      <motion.div
        className="col-span-1 flex flex-col gap-4"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={staggerChildren}
      >
        {tokenUtilityData.map((item, index) => (
          <motion.div
            key={index}
            className="flex items-start gap-4 p-6 bg-[#FFFFFF0D] border border-[#FFFFFF1A] rounded-lg hover:translate-y-[-8px] transition-transform duration-300 cursor-pointer"
            variants={fadeInUp}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            whileHover={{ scale: 1.02 }}
          >
            <div className="flex items-center justify-center p-3 rounded bg-[#007BFF1A]">
              <Image src={vpnKey} alt={item.title} width={24} height={24} />
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="font-bold text-[#FFFFFF] text-lg md:text-2xl">
                {item.title}
              </h2>
              <p className="text-[#FFFFFF99] text-sm md:text-base">
                {item.description}
              </p>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </Section>
  );
}
