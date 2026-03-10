"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";

export default function HeroSection() {
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!glowRef.current) {return;}
      const x = (e.clientX / window.innerWidth - 0.5) * 60;
      const y = (e.clientY / window.innerHeight - 0.5) * 40;
      glowRef.current.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
    };
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-start pt-28 sm:pt-36 pb-0 px-4 overflow-hidden hero-grid">
      {/* Ambient glow that follows cursor subtly */}
      <div
        ref={glowRef}
        className="absolute top-1/3 left-1/2 w-[700px] h-[700px] rounded-full pointer-events-none transition-transform duration-[1200ms] ease-out"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(124,58,237,0.18) 0%, rgba(124,58,237,0.06) 50%, transparent 70%)",
          transform: "translate(-50%, -50%)",
        }}
      />
      {/* Second glow - offset */}
      <div
        className="absolute top-1/2 left-1/3 w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(59,130,246,0.08) 0%, transparent 70%)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center max-w-5xl w-full text-center">
        {/* Badge */}
        <div
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 text-xs font-medium mb-8 cursor-default"
          style={{
            boxShadow: "0 0 0 1px rgba(168,85,247,0.1), 0 0 24px rgba(124,58,237,0.1)",
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
          Web3 Streaming · Powered by Stellar
          <span className="text-purple-400/70 ml-1">→</span>
        </div>

        {/* Headline */}
        <h1 className="font-pp-neue font-extrabold text-[2.8rem] sm:text-6xl md:text-7xl lg:text-[5.5rem] text-white leading-[0.93] tracking-tight mb-6">
          Own Your Stream.
          <br />
          <span className="text-gradient-purple">Own Your Earnings.</span>
        </h1>

        {/* Subheadline */}
        <p className="text-white/50 text-base sm:text-lg max-w-2xl leading-relaxed mb-10">
          Stream without limits, engage your community, and earn instantly with a
          blockchain-powered ecosystem that ensures true ownership and frictionless
          transactions. Built for creators. Designed for the future.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-3 mb-12">
          <Link
            href="/explore"
            className="group w-full sm:w-auto px-7 py-3.5 text-sm font-semibold bg-white text-[#07060f] rounded-xl hover:bg-white/92 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2"
          >
            Launch Your Stream
            <span className="group-hover:translate-x-1 transition-transform duration-200 inline-block">
              →
            </span>
          </Link>
          <Link
            href="/explore"
            className="w-full sm:w-auto px-7 py-3.5 border border-white/12 text-white/70 text-sm font-medium rounded-xl hover:border-white/25 hover:text-white hover:bg-white/[0.05] transition-all duration-200 text-center"
          >
            Explore Streams
          </Link>
        </div>

        {/* Social proof */}
        <div className="flex items-center gap-3 mb-16">
          <div className="flex -space-x-2.5">
            {[1, 2, 3, 4].map((i) => (
              <img
                key={i}
                src={`/Images/waitlist${i}.png`}
                alt=""
                className="w-8 h-8 rounded-full border-2 border-[#07060f] object-cover"
              />
            ))}
          </div>
          <p className="text-sm text-white/45">
            <span className="text-white/80 font-medium">3,000+</span> creators already joined
          </p>
        </div>

        {/* Integration logos */}
        <div className="flex flex-col items-center gap-4">
          <p className="text-[10px] text-white/25 uppercase tracking-[0.15em] font-medium">
            Integrated with
          </p>
          <div className="flex items-center gap-8 sm:gap-12">
            <Image
              src="/Images/stripe-logo.png"
              alt="Stripe"
              width={64}
              height={28}
              className="h-5 w-auto opacity-25 hover:opacity-45 transition-opacity duration-300"
            />
            <Image
              src="/Images/youtube-logo.png"
              alt="YouTube"
              width={80}
              height={20}
              className="h-5 w-auto opacity-25 hover:opacity-45 transition-opacity duration-300"
            />
            <Image
              src="/Images/coinbase-logo.png"
              alt="Coinbase"
              width={80}
              height={20}
              className="h-5 w-auto opacity-25 hover:opacity-45 transition-opacity duration-300"
            />
          </div>
        </div>
      </div>

      {/* Hero image */}
      <div className="relative w-full max-w-6xl mt-14 mx-auto px-0">
        {/* Fade bottom */}
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#07060f] via-[#07060f]/70 to-transparent z-10 pointer-events-none" />
        {/* Top line */}
        <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-purple-500/40 to-transparent" />

        <div
          className="rounded-t-2xl overflow-hidden border border-b-0 border-white/[0.08]"
          style={{
            boxShadow:
              "0 0 0 1px rgba(255,255,255,0.04), 0 -40px 120px rgba(124,58,237,0.12)",
          }}
        >
          <Image
            src="/Images/hero-image-streamfi.png"
            alt="StreamFi Platform"
            width={1280}
            height={720}
            className="w-full h-auto block"
            priority
          />
        </div>
      </div>
    </section>
  );
}