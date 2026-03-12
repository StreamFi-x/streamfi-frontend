"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";

const steps = [
  {
    number: "01",
    title: "Sign Up Your Way",
    description:
      "Continue with Google or connect a Stellar wallet, whichever you prefer. No complicated setup, no crypto knowledge needed to get started.",
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
      "Receive tips directly from your viewers and get paid instantly with no platform cut taken. Your earnings land in your account the moment they are sent.",
  },
];

export default function About() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target
              .querySelectorAll<HTMLElement>(".reveal")
              .forEach((el, i) => {
                setTimeout(() => el.classList.add("visible"), i * 120);
              });
          }
        });
      },
      { threshold: 0.1 }
    );
    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <section id="about" className="py-24 px-4" ref={sectionRef}>
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 xl:gap-20 items-stretch">
          {/* Left: copy */}
          <div>
            <div className="reveal inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 text-xs font-medium mb-7">
              About StreamFi
            </div>

            <h2 className="reveal reveal-delay-1 font-pp-neue font-extrabold text-4xl md:text-5xl text-white leading-tight mb-6">
              A new era of
              <br />
              <span className="text-gradient-purple">
                creator-first streaming
              </span>
            </h2>

            <p className="reveal reveal-delay-2 text-white/50 text-sm leading-relaxed mb-10">
              StreamFi is a live-streaming platform built to put creators first.
              Sign up with Google or a wallet, go live in seconds, and get paid
              instantly by your viewers with no middleman taking a cut. We use
              blockchain technology under the hood so payments are fast and
              transparent, but you never have to think about any of that.
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
                    <h3 className="text-white text-sm font-semibold mb-1">
                      {step.title}
                    </h3>
                    <p className="text-white/45 text-sm leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: image */}
          <div className="reveal reveal-delay-2 flex flex-col min-h-[480px]">
            <div className="relative flex-1">
              {/* Glow */}
              <div
                className="absolute inset-0 rounded-3xl blur-3xl -z-10 scale-95 opacity-50"
                style={{
                  background:
                    "radial-gradient(ellipse at 40% 50%, rgba(124,58,237,0.25), transparent 70%)",
                }}
              />
              {/* Image fills the entire flex child */}
              <div
                className="absolute inset-0 rounded-2xl overflow-hidden border border-white/[0.08]"
                style={{
                  boxShadow:
                    "0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)",
                }}
              >
                <Image
                  src="/Images/streamer.jpg"
                  alt="StreamFi Platform — Creator streaming"
                  fill
                  className="object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
