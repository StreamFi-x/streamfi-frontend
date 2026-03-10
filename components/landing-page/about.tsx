"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { AboutImage2 } from "@/public/Images";

const steps = [
  {
    number: "01",
    title: "Connect Your Wallet",
    description:
      "Sign in with your Stellar wallet. No email, no passwords. Your identity and earnings are fully yours.",
  },
  {
    number: "02",
    title: "Go Live Instantly",
    description:
      "Start broadcasting in seconds. Low-latency HD streams with real-time chat and instant audience engagement.",
  },
  {
    number: "03",
    title: "Earn Without Limits",
    description:
      "Receive tips, subscriptions, and staking rewards directly to your wallet. Zero platform cuts. Instant settlement.",
  },
];

export default function About() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.querySelectorAll<HTMLElement>(".reveal").forEach((el, i) => {
              setTimeout(() => el.classList.add("visible"), i * 120);
            });
          }
        });
      },
      { threshold: 0.1 }
    );
    if (sectionRef.current) {observer.observe(sectionRef.current);}
    return () => observer.disconnect();
  }, []);

  return (
    <section id="about" className="py-24 px-4" ref={sectionRef}>
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 xl:gap-20 items-center">
          {/* Left: copy */}
          <div>
            <div className="reveal inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 text-xs font-medium mb-7">
              About StreamFi
            </div>

            <h2 className="reveal reveal-delay-1 font-pp-neue font-extrabold text-4xl md:text-5xl text-white leading-tight mb-6">
              A new era of
              <br />
              <span className="text-gradient-purple">creator-first streaming</span>
            </h2>

            <p className="reveal reveal-delay-2 text-white/50 text-sm leading-relaxed mb-10">
              StreamFi is a Web3-powered streaming platform built to give content creators and
              gamers full control over their earnings. Unlike traditional platforms that take large
              cuts and delay payouts, StreamFi uses blockchain technology to enable instant crypto
              tipping, NFT-based memberships, and DeFi staking rewards, all without middlemen.
            </p>

            {/* Steps */}
            <div className="space-y-5">
              {steps.map((step, i) => (
                <div
                  key={i}
                  className={`reveal reveal-delay-${i + 3} flex gap-4 group`}
                >
                  <div className="flex-shrink-0 w-9 h-9 rounded-xl border border-purple-500/25 bg-purple-500/[0.08] flex items-center justify-center transition-all duration-300 group-hover:border-purple-500/50 group-hover:bg-purple-500/15">
                    <span className="text-purple-400 text-xs font-bold font-pp-neue">
                      {step.number}
                    </span>
                  </div>
                  <div className="pt-0.5">
                    <h3 className="text-white text-sm font-semibold mb-1">{step.title}</h3>
                    <p className="text-white/45 text-sm leading-relaxed">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: image */}
          <div className="reveal reveal-delay-2 relative">
            <div
              className="absolute inset-0 rounded-3xl blur-3xl -z-10 scale-95 opacity-50"
              style={{
                background:
                  "radial-gradient(ellipse at 40% 50%, rgba(124,58,237,0.25), transparent 70%)",
              }}
            />
            <div
              className="rounded-2xl overflow-hidden border border-white/[0.08]"
              style={{
                boxShadow: "0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)",
              }}
            >
              <Image
                src={AboutImage2}
                alt="StreamFi Platform — Creator dashboard"
                className="w-full h-auto block"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
