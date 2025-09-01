"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { Mail } from "lucide-react";
import {Logo} from "@/public/Images";
import Section from "@/components/layout/Section";

export default function Footer() {
  const footerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        staggerChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div className="bg-background-2">
      {" "}
      <motion.footer
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={footerVariants}
      >
        <Section
          id="footer"
          className="flex flex-col md:flex-row justify-between items-center gap-y-4"
        >
          <motion.div className="mb-4 md:mb-0" variants={itemVariants}>
            <Link href="/" className="flex items-center">
              <Image
                src={Logo || "/placeholder.svg"}
                alt="Streamfi logo"
                width={128}
                height={50}
              />
            </Link>
          </motion.div>

          <motion.div
            className="flex flex-col items-center justify-center text-center mb-4 md:mb-0"
            variants={itemVariants}
          >
            <div className="flex items-center gap-2 text-white text-sm">
              <Link
                href="/terms"
                className="hover:text-gray-300 transition-colors"
              >
                Terms of Service
              </Link>
              <span className="text-white">|</span>
              <Link
                href="/privacy"
                className="hover:text-gray-300 transition-colors"
              >
                Privacy Policy
              </Link>
            </div>

            <div className="mt-1 text-gray-400 text-xs">
              Copyright © {new Date().getFullYear()}. All Rights Reserved.
            </div>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Link
              href="mailto:streamfi25@gmail.com"
              className="flex items-center gap-2 text-white hover:text-gray-300 transition-colors"
            >
              <Mail size={18} />
              <span>Contact Us</span>
            </Link>
          </motion.div>
        </Section>
      </motion.footer>
    </div>
  );
}
