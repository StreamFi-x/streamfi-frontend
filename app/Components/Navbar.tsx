"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import Image from "next/image";

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

  return (
    <div className="w-full px-5 md:px-10 lg:px-20 fixed z-50">
      <nav className="bg-white/5 backdrop-blur-lg rounded-3xl p-4  w-full text-white">
        <div className="container mx-auto flex items-center justify-between">
          {/* Logo */}
          <div className="text-xl font-bold flex items-center space-x-2">
            <Image
            src={'/images/streamFiLogo.svg'}
            alt="StreamFi Logo"
            width={100}
            height={100}
            />
          </div>

          {/* Desktop Menu */}
          <ul className="hidden md:flex space-x-3 text-xs lg:text-sm">
            {navLinks.map((link, index) => (
              <li key={index}>
                <Link
                  href={link.href}
                  className={`transition-colors duration-500 ${ 
                    pathname === link.href ? "text-white font-medium " : "text-white/60 hover:text-white/80 font-normal"
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
          <button className="hidden md:block bg-white text-[#1E1E1E] px-4 py-2 rounded-lg font-medium">
            Get started
          </button>

          {/* Mobile Menu Button */}
          <button className="md:hidden" onClick={() => setIsOpen(!isOpen)}>
            {isOpen ? <X className="w-6 h-6 transition duration-500" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        <div className={`md:hidden overflow-hidden transition-all duration-500 ease-in-out ${isOpen ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'}`}>
          <ul className="flex flex-col items-center space-y-4 mt-4 bg-[#0D0216] py-4">
            {navLinks.map((link, index) => (
              <li key={index}>
                <Link 
                  href={link.href} 
                  className={`transition-colors duration-500 w-full ${pathname === link.href ? 'text-white' : 'text-white/50 hover:text-white/80'}`}
                  onClick={() => setIsOpen(false)}
                >
                  {link.name}
                </Link>
              </li>
            ))}
            <li>
              <button className="bg-white text-black px-4 py-2 rounded-lg font-medium w-full" onClick={() => setIsOpen(false)}>
                Get started
              </button>
            </li>
          </ul>
        </div>
      </nav>
    </div>
  );
};

export default Navbar;
