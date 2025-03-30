"use client";
import React, { useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import Section from "../layout/Section";

interface WaitlistProps {
  initialCount?: number;
  onSubmit?: (email: string) => Promise<void>;
}

const Waitlist: React.FC<WaitlistProps> = ({
  initialCount = 3000,
  onSubmit,
}) => {
  const [email, setEmail] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  const avatars: string[] = [
    "/Images/waitlist1.png",
    "/Images/waitlist2.png",
    "/Images/waitlist3.png",
    "/Images/waitlist4.png",
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) return;

    setIsSubmitting(true);

    try {
      if (onSubmit) {
        await onSubmit(email);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      setIsSubmitted(true);
      setEmail("");

      setTimeout(() => {
        setIsSubmitted(false);
      }, 3000);
    } catch (error) {
      console.error("Error submitting email:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Section
      id="waitlist"
      className="text-white  relative flex flex-col items-center justify-center"
      wrapperClassName="bg-gradient-to-b from-transparent to-background-2"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-8"
      >
        <h1 className="text-2xl sm:text-4xl xl:text-5xl font-extrabold font-pp-neue max-w-5xl text-white mb-4">
          Join the Revolution: Own Your Stream, Own Your Earnings
        </h1>

        <p className="text-white/80 max-w-2xl font-normal mx-auto">
          Sign up for early access and be among the first to explore
          StreamFi&apos;s decentralized streaming platform. Get exclusive perks,
          early feature access, and shape the future of streaming!
        </p>
      </motion.div>

      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        onSubmit={handleSubmit}
        className="flex flex-col sm:flex-row gap-4 items-center relative z-20 justify-center w-full max-w-2xl mx-auto mb-6"
      >
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          className=" py-3 px-4 bg-[#272526] rounded-lg  w-full md:max-w-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-300"
          required
        />

        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
          type="submit"
          disabled={isSubmitting}
          className={`py-3 px-6 bg-[#5A189A] hover:bg-purple-700  rounded-lg w-full sm:w-fit text-white font-medium transition-colors duration-300 ${
            isSubmitting ? "opacity-70 cursor-not-allowed" : ""
          }`}
        >
          {isSubmitting
            ? "Joining..."
            : isSubmitted
            ? "Joined!"
            : "Join the Waitlist"}
        </motion.button>
      </motion.form>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="flex flex-col sm:flex-row items-center justify-center gap-2 text-gray-300"
      >
        <div className="flex -space-x-2">
          {avatars.map((avatar, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + index * 0.1 }}
            >
              <Image
                src={avatar}
                alt={`User ${index + 1}`}
                width={32}
                height={32}
                className="w-8 h-8 md:text-base text-[8px] rounded-full border-2 border-gray-800"
              />
            </motion.div>
          ))}
        </div>
        <span>{initialCount}+ creators and viewers Joined!</span>
      </motion.div>

      <div className="  flex opacity-20 justify-center pointer-events-none overflow-hidden">
        <p
          className="text-[4rem] md:text-[12rem] font-extrabold p-0 m-0"
          style={{
            color: "rgba(255, 255, 255, 0.1)",
            WebkitTextStroke: "0.8px #f1f1f1",
            textShadow: "2px 2px 4px rgba(0, 0, 0, 0.5)",
          }}
        >
          Waitlist
        </p>
      </div>

      <div
        className="absolute bottom-0 inset-0 bg-[url('/Images/waitlist.png')] bg-cover bg-center opacity-20 pointer-events-none"
        style={{ bottom: "-24px" }}
      ></div>
    </Section>
  );
};

export default Waitlist;
