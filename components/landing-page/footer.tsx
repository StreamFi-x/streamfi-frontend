"use client";

import Link from "next/link";
import Image from "next/image";
import { Mail } from "lucide-react";
import { Logo } from "@/public/Images";

const links = {
  product: [
    { name: "Explore Streams", href: "/explore" },
    { name: "Go Live", href: "/explore" },
    { name: "Dashboard", href: "/dashboard/home" },
    { name: "Recordings", href: "/dashboard/recordings" },
  ],
  community: [
    { name: "Twitter / X", href: "https://x.com/_streamfi", external: true },
    { name: "Discord", href: "https://discord.gg/jPhndJFC", external: true },
    {
      name: "Telegram",
      href: "https://t.me/+slCXibBFWF05NDQ0",
      external: true,
    },
  ],
  legal: [
    { name: "Terms of Service", href: "/terms" },
    { name: "Privacy Policy", href: "/privacy" },
  ],
};

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/[0.07]">
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-14">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link href="/" className="inline-block mb-5">
              <Image src={Logo} alt="StreamFi" width={120} height={38} />
            </Link>
            <p className="text-white/35 text-sm leading-relaxed mb-6 max-w-xs">
              The creator-first live streaming platform. Own your stream, own
              your earnings, powered by Web3.
            </p>
            {/* Social icons */}
            <div className="flex items-center gap-2">
              {[
                {
                  href: "https://x.com/_streamfi",
                  src: "/Images/x.png",
                  label: "X",
                },
                {
                  href: "https://discord.gg/jPhndJFC",
                  src: "/Images/discord.svg",
                  label: "Discord",
                },
                {
                  href: "https://t.me/+slCXibBFWF05NDQ0",
                  src: "/Images/Telegram.png",
                  label: "Telegram",
                },
              ].map(s => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center hover:bg-white/10 hover:border-white/15 transition-all duration-200"
                  aria-label={s.label}
                >
                  <Image
                    src={s.src}
                    alt={s.label}
                    width={14}
                    height={14}
                    className="opacity-55 w-[14px] h-[14px] object-contain"
                  />
                </a>
              ))}
            </div>
          </div>

          {/* Product */}
          <div>
            <h3 className="text-white/40 text-[10px] font-semibold uppercase tracking-[0.12em] mb-5">
              Product
            </h3>
            <ul className="space-y-3">
              {links.product.map(l => (
                <li key={l.name}>
                  <Link
                    href={l.href}
                    className="text-white/45 hover:text-white/80 text-sm transition-colors duration-200"
                  >
                    {l.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Community */}
          <div>
            <h3 className="text-white/40 text-[10px] font-semibold uppercase tracking-[0.12em] mb-5">
              Community
            </h3>
            <ul className="space-y-3">
              {links.community.map(l => (
                <li key={l.name}>
                  <a
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/45 hover:text-white/80 text-sm transition-colors duration-200"
                  >
                    {l.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal + Contact */}
          <div>
            <h3 className="text-white/40 text-[10px] font-semibold uppercase tracking-[0.12em] mb-5">
              Legal
            </h3>
            <ul className="space-y-3 mb-6">
              {links.legal.map(l => (
                <li key={l.name}>
                  <Link
                    href={l.href}
                    className="text-white/45 hover:text-white/80 text-sm transition-colors duration-200"
                  >
                    {l.name}
                  </Link>
                </li>
              ))}
            </ul>
            <a
              href="mailto:streamfi25@gmail.com"
              className="inline-flex items-center gap-2 text-white/45 hover:text-white/80 text-sm transition-colors duration-200"
            >
              <Mail className="w-3.5 h-3.5" />
              Contact Us
            </a>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-white/[0.07] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-white/25 text-xs">
            © {year} StreamFi. All rights reserved.
          </p>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-white/25 text-xs">
              All systems operational
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
