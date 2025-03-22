'use client'
import Image from "next/image";
import { motion } from "framer-motion";
import { tokenUtilityData } from "@/data/landing-page/streamTokenUtility";

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
    visible: { opacity: 1, y: 0 }
  };

  const staggerChildren = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  const floatAnimation = {
    initial: { y: 0 },
    animate: {
      y: [0, -10, 0],
      transition: {
        duration: 3,
        repeat: Infinity,
        repeatType: "reverse" as const,
        ease: "easeInOut"
      }
    }
  };

  return (
    <section className="w-full mt-5 py-10 px-4 md:px-20 md:my-20 flex flex-col items-center md:gap-[15px] relative bg-transparent overflow-hidden">
      <motion.h1 
        className="text-[#F1F1F1] font-extrabold text-3xl md:text-[40px] text-center m-0"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={fadeInUp}
        transition={{ duration: 0.5 }}
      >
        $Stream Token Utility
      </motion.h1>
      
      <motion.p 
        className="text-[#FFFFFFCC] text-sm md:text-base font-normal text-center max-w-[844px] z-10"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={fadeInUp}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        Lorem ipsum dolor sit amet consectetur. Dictum elementum malesuada sed
        a. Cursus sem pellentesque porttitor fringilla consectetur egestas
      </motion.p>

      {/* Mobile and desktop layout with conditional styling */}
      <motion.div 
        className="w-full max-w-[350px] md:w-[533.22px] md:h-[492px] md:ml-auto mt-10 flex flex-col items-start justify-stretch gap-4 md:gap-5 z-10"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={staggerChildren}
      >
        {tokenUtilityData.map((item, index) => (
          <motion.div
            key={index}
            className="w-full h-auto min-h-[108px] border-[1px] border-[#FFFFFF1A] rounded-lg bg-[#FFFFFF0D] p-4 md:p-6 flex flex-row items-start justify-start gap-4 md:gap-8 transition-transform duration-300 hover:-translate-y-2 cursor-pointer"
            variants={fadeInUp}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            whileHover={{ scale: 1.02 }}
          >
            <div className="min-w-10 w-10 h-10 md:w-12 md:h-12 rounded bg-[#007BFF1A] flex items-center justify-center">
              <Image src={vpnKey} alt="vpn_key" height={24} width={24} />
            </div>
            <div className="flex flex-col items-start gap-1">
              <h2 className="font-bold text-[#FFFFFF] text-lg md:text-2xl">
                {item.title}
              </h2>
              <p className="text-[#FFFFFF99] font-normal text-xs md:text-base">
                {item.description}
              </p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Token images with animations - responsive positioning */}
      <motion.div 
        className="absolute  top-[55%] left-[5%] md:left-[14%] hidden md:flex items-center justify-center w-[150px] h-[120px] md:w-[449.8px] md:h-[304.2px] z-0"
        variants={floatAnimation}
        initial="initial"
        animate="animate"
      >
        <Image
          src={token1}
          alt="token1"
          height={100}
          width={100}
          className="object-cover h-full w-full"
        />
      </motion.div>

      <motion.div 
        className="absolute top-[35%] left-[2%] md:left-[7%] hidden md:flex items-center justify-center w-[100px] h-[80px] md:w-[306px] md:h-[206px] blur-[2px]"
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
        className="absolute top-[20%] left-[15%] md:left-[28%] hidden md:flex items-center justify-center w-[80px] h-[60px] md:w-[204px] md:h-[138px] blur-[3px]"
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
        className="absolute top-[19%] left-[0%] md:left-[3%] hidden md:flex items-center justify-center w-[90px] h-[70px] md:w-[204px] md:h-[138px] blur-[2px]"
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
        className="absolute top-[3%] left-[8%] md:left-[13%] hidden md:flex items-center justify-center w-[90px] h-[70px] md:w-[204px] md:h-[138px] blur-[2px]"
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

      {/* FAQs section at the bottom for mobile view as shown in Figma */}
      <motion.div 
        className="w-full max-w-[350px] md:max-w-[533.22px] mt-16 md:mt-20 z-10"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={fadeInUp}
        transition={{ duration: 0.5, delay: 0.8 }}
      >
        <h2 className="text-[#F1F1F1] font-extrabold text-2xl md:text-3xl text-center mb-4">
          FAQs
        </h2>
        <p className="text-[#FFFFFFCC] text-sm md:text-base font-normal text-center">
          Everything you need to know about StreamFi.
        </p>
      </motion.div>
    </section>
  );
}