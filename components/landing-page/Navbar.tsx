"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import Section from "@/components/layout/section";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const navLinks = [
    { name: "Home", href: "/" },
    { name: "Earn", href: "#earn" },
    { name: "For Creators", href: "#creators" },
    { name: "Community", href: "#community" },
    { name: "About Us", href: "#about" },
  ];

  const menuVariants = {
    closed: {
      opacity: 0,
      height: 0,
      transition: {
        duration: 0.2,
        when: "afterChildren",
        staggerChildren: 0.05,
        staggerDirection: -1,
      },
    },
    open: {
      opacity: 1,
      height: "auto",
      transition: {
        duration: 0.2,
        when: "beforeChildren",
        staggerChildren: 0.1,
        staggerDirection: 1,
      },
    },
  };

  const itemVariants = {
    closed: { opacity: 0, y: -10 },
    open: { opacity: 1, y: 0 },
  };

  return (
    <Section
      wrapperClassName=" !py-0 mb-10 md:mb-5 flex w-full justify-center"
      className="md:!px-10 z-50 fixed top-5 md:top-10"
    >
      <nav className="bg-white/5 backdrop-blur-lg rounded-3xl p-4 w-full text-white">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center space-x-2 font-bold text-xl">
            <Image
              src={"/images/stream-fi-logo.svg"}
              alt="StreamFi Logo"
              width={120}
              height={120}
            />
          </div>

          {/* Desktop Menu */}
          <ul className="hidden lg:flex space-x-3 text-xs lg:text-sm">
            {navLinks.map((link, index) => (
              <li key={index}>
                <Link
                  href={link.href}
                  className={`transition-colors duration-500 ${
                    pathname === link.href
                      ? "text-white font-medium"
                      : "text-white/60 hover:text-white/80 font-normal"
                  }`}
                >
                  {link.name}
                  {index < navLinks.length - 1 && (
                    <span className="text-gray-400 ml-3"> / </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>

          {/* Get Started Button */}
          <Link href="/explore" className="hidden lg:block">
            <Button className="bg-white hover:text-white text-[#1E1E1E] px-4 py-2 rounded-lg font-medium w-full">
              Get started
            </Button>
          </Link>

          {/* Mobile Menu Button */}
          <motion.button
            className="lg:hidden bg-[#B8B8B82E] backdrop-blur-lg rounded-lg px-3 py-1"
            onClick={() => setIsOpen(!isOpen)}
            whileTap={{ scale: 0.95 }}
          >
            <AnimatePresence mode="wait">
              {isOpen ? (
                <motion.div
                  key="close"
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <X className="w-6 h-6" />
                </motion.div>
              ) : (
                <motion.div
                  key="menu"
                  initial={{ rotate: 90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: -90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Menu className="w-6 h-6" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              className="lg:hidden w-full overflow-hidden"
              initial="closed"
              animate="open"
              exit="closed"
              variants={menuVariants}
            >
              <motion.ul className="flex flex-col items-center justify-center w-full mt-4 py-4">
                {navLinks.map((link, index) => (
                  <motion.li
                    key={index}
                    className="h-16 flex justify-center items-center w-full"
                    variants={itemVariants}
                    whileHover={{ scale: 1.05, x: 5 }}
                  >
                    <Link
                      href={link.href}
                      className={`transition-colors duration-500 w-full h-full hover:text-white/80 text-center ${
                        pathname === link.href ? "text-white/80" : "text-white"
                      }`}
                      onClick={() => setIsOpen(false)}
                    >
                      {link.name}
                    </Link>
                  </motion.li>
                ))}
                <motion.li
                  className="w-full mt-2"
                  variants={itemVariants}
                  whileHover={{ scale: 1.03 }}
                >
                  <motion.button
                    className="bg-white text-black px-4 py-5 rounded-lg font-medium w-full"
                    onClick={() => setIsOpen(false)}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Link href={"/explore"}>Get started</Link>
                  </motion.button>
                </motion.li>
              </motion.ul>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </Section>
  );
};

export default Navbar;
