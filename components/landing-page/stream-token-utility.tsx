"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";

const utilities = [
  {
    icon: "◈",
    title: "Staking Rewards",
    description:
      "Lock your $STREAM tokens and earn passive rewards. The longer you stake, the more you earn.",
    iconColor: "text-purple-400",
    borderColor: "border-purple-500/20",
    bgColor: "bg-purple-500/[0.08]",
    hoverBorder: "hover:border-purple-500/40",
  },
  {
    icon: "◯",
    title: "Ad-Free Viewing",
    description:
      "Use tokens for a premium, uninterrupted experience. No ads, ever. Pure streaming.",
    iconColor: "text-blue-400",
    borderColor: "border-blue-500/20",
    bgColor: "bg-blue-500/[0.08]",
    hoverBorder: "hover:border-blue-500/40",
  },
  {
    icon: "⬡",
    title: "Creator Tipping",
    description:
      "Support streamers directly with $STREAM tokens. 100% of every tip reaches the creator instantly.",
    iconColor: "text-fuchsia-400",
    borderColor: "border-fuchsia-500/20",
    bgColor: "bg-fuchsia-500/[0.08]",
    hoverBorder: "hover:border-fuchsia-500/40",
  },
  {
    icon: "⬖",
    title: "DAO Governance",
    description:
      "Vote on key platform decisions. Your tokens = your voice in the StreamFi ecosystem.",
    iconColor: "text-cyan-400",
    borderColor: "border-cyan-500/20",
    bgColor: "bg-cyan-500/[0.08]",
    hoverBorder: "hover:border-cyan-500/40",
  },
];

const tokenImages = [
  {
    src: "/Images/tokens/token1.svg",
    size: 64,
    delay: "0s",
    pos: "top-6 right-16",
  },
  {
    src: "/Images/tokens/token2.svg",
    size: 48,
    delay: "1s",
    pos: "bottom-12 left-10",
  },
  {
    src: "/Images/tokens/token3.svg",
    size: 40,
    delay: "2s",
    pos: "top-1/3 left-6",
  },
  {
    src: "/Images/tokens/token4.svg",
    size: 40,
    delay: "0.5s",
    pos: "top-1/3 right-6",
  },
  {
    src: "/Images/tokens/token5.svg",
    size: 36,
    delay: "1.5s",
    pos: "bottom-1/4 right-12",
  },
];

export default function StreamTokenUtility() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target
              .querySelectorAll<HTMLElement>(".reveal")
              .forEach((el, i) => {
                setTimeout(() => el.classList.add("visible"), i * 90);
              });
          }
        });
      },
      { threshold: 0.08 }
    );
    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="stream-token-utility"
      className="py-24 px-4 relative"
      ref={sectionRef}
    >
      {/* Subtle bg gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 20% 60%, rgba(59,130,246,0.04), transparent 60%)",
        }}
      />

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 xl:gap-24 items-center">
          {/* Visual — floating token sphere */}
          <div className="reveal order-2 lg:order-1 relative mx-auto w-full max-w-sm">
            {/* Rings */}
            <div className="relative w-72 h-72 mx-auto flex items-center justify-center">
              <div
                className="absolute inset-0 rounded-full border border-purple-500/[0.12] animate-spin-slow"
                style={{ animationDuration: "22s" }}
              />
              <div
                className="absolute inset-8 rounded-full border border-purple-500/[0.18] animate-spin-slow-reverse"
                style={{ animationDuration: "16s" }}
              />
              <div className="absolute inset-16 rounded-full border border-purple-500/[0.22]" />

              {/* Floating token images */}
              {tokenImages.map((t, i) => (
                <div
                  key={i}
                  className={`absolute token-float ${t.pos} opacity-60`}
                  style={{ animationDelay: t.delay }}
                >
                  <Image src={t.src} alt="" width={t.size} height={t.size} />
                </div>
              ))}

              {/* Center token badge */}
              <div
                className="relative z-10 w-20 h-20 rounded-full flex items-center justify-center glow-pulse"
                style={{
                  background:
                    "radial-gradient(circle at 40% 35%, rgba(168,85,247,0.5), rgba(124,58,237,0.3))",
                  border: "1px solid rgba(168,85,247,0.4)",
                  boxShadow:
                    "0 0 0 8px rgba(124,58,237,0.08), 0 0 40px rgba(124,58,237,0.3)",
                }}
              >
                <span className="font-pp-neue font-bold text-white/90 text-3xl tracking-tight">
                  $
                </span>
              </div>
            </div>

            {/* Glow behind ring */}
            <div
              className="absolute inset-0 rounded-full blur-3xl opacity-30 pointer-events-none"
              style={{
                background:
                  "radial-gradient(circle at 50% 50%, rgba(124,58,237,0.4), transparent 60%)",
              }}
            />
          </div>

          {/* Content */}
          <div className="order-1 lg:order-2">
            <div className="reveal inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 text-xs font-medium mb-7">
              Payments & Token
            </div>

            <h2 className="reveal reveal-delay-1 font-pp-neue font-extrabold text-4xl md:text-5xl text-white leading-tight mb-4">
              Built on Stellar.
              <br />
              <span className="text-gradient-purple">Fast by design.</span>
            </h2>

            <p className="reveal reveal-delay-2 text-white/45 text-sm leading-relaxed mb-6">
              StreamFi runs on the Stellar network, one of the fastest
              blockchains on the planet with 3–5 second finality and near-zero
              fees. Every tip, payout, and stablecoin transaction settles
              instantly, so creators get paid the moment it happens. No waiting.
              No gas wars.
            </p>

            {/* Stellar network stats */}
            <div className="reveal reveal-delay-3 grid grid-cols-3 gap-3 mb-8">
              {[
                { value: "3–5s", label: "Finality" },
                { value: "~$0.00", label: "Fee per tx" },
                { value: "USDC", label: "Stablecoin" },
              ].map(stat => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-3 text-center"
                >
                  <p className="font-pp-neue font-bold text-white text-sm mb-0.5">
                    {stat.value}
                  </p>
                  <p className="text-white/35 text-[10px] uppercase tracking-wide">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              {utilities.map((u, i) => (
                <div
                  key={i}
                  className={`reveal reveal-delay-${i + 3} flex items-start gap-4 p-4 rounded-xl border ${u.borderColor} ${u.bgColor} ${u.hoverBorder} hover:bg-white/[0.05] transition-all duration-300 cursor-default group`}
                >
                  <div
                    className={`text-2xl ${u.iconColor} flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform duration-200`}
                  >
                    {u.icon}
                  </div>
                  <div>
                    <h3 className="text-white text-sm font-semibold mb-1">
                      {u.title}
                    </h3>
                    <p className="text-white/45 text-xs leading-relaxed">
                      {u.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
