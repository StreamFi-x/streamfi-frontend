"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";
import ConnectWalletModal from "@/components/connectWallet";
import { usePrivyAuth } from "@/hooks/usePrivyAuth";
import { useStellarWallet } from "@/contexts/stellar-wallet-context";

const navLinks = [
  { name: "Features", href: "#benefits" },
  { name: "Earn", href: "#stream-token-utility" },
  { name: "Community", href: "#community" },
  { name: "FAQ", href: "#frequently-asked-questions" },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const router = useRouter();
  const { authenticated: privyAuthenticated } = usePrivyAuth();
  const { isConnected: stellarConnected } = useStellarWallet();
  // Defer until after hydration — both stellarConnected (localStorage) and
  // privyAuthenticated (Privy context) differ between server and first client render.
  const isAuthenticated = mounted && (privyAuthenticated || stellarConnected);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleAuthClick = () => {
    if (isAuthenticated) {
      router.push("/explore");
    } else {
      setIsAuthModalOpen(true);
    }
  };

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4 px-4 md:px-6">
      <nav
        className={`w-full max-w-6xl rounded-2xl border transition-all duration-500 ${
          scrolled
            ? "bg-[#07060f]/85 backdrop-blur-2xl border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.5)]"
            : "bg-white/[0.04] backdrop-blur-md border-white/[0.07]"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-3.5">
          {/* Logo */}
          <Link href="/" className="flex items-center flex-shrink-0">
            <Image
              src="/Images/streamFiLogo.svg"
              alt="StreamFi"
              width={108}
              height={34}
              priority
            />
          </Link>

          {/* Desktop nav links */}
          <ul className="hidden lg:flex items-center gap-1">
            {navLinks.map(link => (
              <li key={link.name}>
                <Link
                  href={link.href}
                  className="px-4 py-2 text-sm text-white/55 hover:text-white rounded-lg hover:bg-white/[0.06] transition-all duration-200"
                >
                  {link.name}
                </Link>
              </li>
            ))}
          </ul>

          {/* Desktop CTAs */}
          <div className="hidden lg:flex items-center gap-3">
            {!isAuthenticated && (
              <button
                onClick={handleAuthClick}
                className="text-sm text-white/60 hover:text-white transition-colors duration-200"
              >
                Sign in
              </button>
            )}
            <button
              onClick={handleAuthClick}
              className="px-4 py-2 text-sm font-semibold bg-white text-[#07060f] rounded-xl hover:bg-white/90 active:scale-95 transition-all duration-200"
            >
              {isAuthenticated ? "Go to app →" : "Get started →"}
            </button>
          </div>

          {/* Mobile toggle */}
          <button
            className="lg:hidden p-2 text-white/60 hover:text-white transition-colors duration-200 rounded-lg hover:bg-white/[0.06]"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
          >
            <div
              className="transition-all duration-200"
              style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}
            >
              {isOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </div>
          </button>
        </div>

        {/* Mobile menu */}
        <div
          className="lg:hidden overflow-hidden transition-all duration-300 ease-in-out"
          style={{ maxHeight: isOpen ? "400px" : "0px" }}
        >
          <div className="border-t border-white/[0.07] px-4 py-4 space-y-1">
            {navLinks.map(link => (
              <Link
                key={link.name}
                href={link.href}
                className="block px-4 py-3 text-sm text-white/65 hover:text-white hover:bg-white/[0.06] rounded-xl transition-all duration-200"
                onClick={() => setIsOpen(false)}
              >
                {link.name}
              </Link>
            ))}
            <div className="pt-3 space-y-2">
              {!isAuthenticated && (
                <button
                  onClick={() => {
                    setIsOpen(false);
                    handleAuthClick();
                  }}
                  className="block w-full text-center px-4 py-3 text-sm text-white/60 border border-white/10 rounded-xl hover:bg-white/[0.06] transition-all duration-200"
                >
                  Sign in
                </button>
              )}
              <button
                onClick={() => {
                  setIsOpen(false);
                  handleAuthClick();
                }}
                className="block w-full text-center px-4 py-3 text-sm font-semibold bg-white text-[#07060f] rounded-xl hover:bg-white/90 transition-all duration-200"
              >
                {isAuthenticated ? "Go to app →" : "Get started →"}
              </button>
            </div>
          </div>
        </div>
      </nav>
      <ConnectWalletModal
        isModalOpen={isAuthModalOpen}
        setIsModalOpen={setIsAuthModalOpen}
      />
    </header>
  );
}
