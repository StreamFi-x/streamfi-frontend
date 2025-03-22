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
    <section className="relative grid grid-cols-1 md:grid-cols-2 gap-8 py-10 px-4 md:px-20 bg-transparent overflow-hidden">
      {/* Content Container */}
      <div className="col-span-1 md:col-span-2 flex flex-col items-center gap-6">
        <motion.h1 
          className="text-[#F1F1F1] font-extrabold text-3xl md:text-[40px] text-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeInUp}
          transition={{ duration: 0.5 }}
        >
          $Stream Token Utility
        </motion.h1>
        
        <motion.p 
          className="text-[#FFFFFFCC] text-sm md:text-base font-normal text-center max-w-[844px]"
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

      {/* Token Images Grid */}
      <div className="hidden md:flex col-span-1 relative">
        <div className="grid grid-cols-3 gap-4 p-4">
          {[token1, token2, token3, token4, token5].map((token, index) => (
            <motion.div
              key={index}
              className={`flex items-center justify-center p-2 ${
                index === 0 ? 'col-span-2 row-span-2' : 'col-span-1'
              }`}
              variants={floatAnimation}
              initial="initial"
              animate="animate"
              transition={{ delay: index * 0.5 }}
            >
              <Image
                src={token}
                alt={`token${index + 1}`}
                width={index === 0 ? 200 : 100}
                height={index === 0 ? 200 : 100}
                className={`object-contain ${index !== 0 ? 'blur-[2px]' : ''}`}
              />
            </motion.div>
          ))}
        </div>
      </div>

      {/* Cards Container */}
      <motion.div 
        className="col-span-1 flex flex-col gap-4 p-4"
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

      
      
    </section>
  );
}