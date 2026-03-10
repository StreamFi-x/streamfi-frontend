"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

function useCountUp(end: number, duration: number, active: boolean) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active) {return;}
    let start = 0;
    const increment = end / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [end, duration, active]);
  return count;
}

const stats = [
  { value: 25, suffix: "k+", label: "Active Members" },
  { value: 5, suffix: "k+", label: "Content Creators" },
  { value: 5, suffix: "k+", label: "Web3 Integrations" },
  { value: 24, suffix: "/7", label: "Community Support" },
];

const socials = [
  {
    name: "Twitter / X",
    href: "https://x.com/_streamfi",
    icon: "/Images/x.png",
    handle: "@_streamfi",
    desc: "Latest updates & announcements",
    bg: "from-white/[0.05]",
    hoverBorder: "hover:border-white/20",
  },
  {
    name: "Telegram",
    href: "https://t.me/+slCXibBFWF05NDQ0",
    icon: "/Images/Telegram.png",
    handle: "t.me/streamfi",
    desc: "Real-time community chat",
    bg: "from-blue-900/20",
    hoverBorder: "hover:border-blue-500/30",
  },
  {
    name: "Discord",
    href: "https://discord.gg/jPhndJFC",
    icon: "/Images/discord.svg",
    handle: "discord.gg/streamfi",
    desc: "Creators, builders & enthusiasts",
    bg: "from-indigo-900/20",
    hoverBorder: "hover:border-indigo-500/30",
  },
];

export default function Community() {
  const sectionRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActive(true);
            entry.target.querySelectorAll<HTMLElement>(".reveal").forEach((el, i) => {
              setTimeout(() => el.classList.add("visible"), i * 80);
            });
          }
        });
      },
      { threshold: 0.15 }
    );
    if (sectionRef.current) {observer.observe(sectionRef.current);}
    return () => observer.disconnect();
  }, []);

  const c0 = useCountUp(stats[0].value, 1800, active);
  const c1 = useCountUp(stats[1].value, 1800, active);
  const c2 = useCountUp(stats[2].value, 1800, active);
  const c3 = useCountUp(stats[3].value, 1800, active);
  const counts = [c0, c1, c2, c3];

  return (
    <section id="community" className="py-24 px-4 relative" ref={sectionRef}>
      {/* Background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 50%, rgba(124,58,237,0.04), transparent)",
        }}
      />

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Heading */}
        <div className="text-center mb-14">
          <div className="reveal inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 text-xs font-medium mb-6">
            Community
          </div>
          <h2 className="reveal reveal-delay-1 font-pp-neue font-extrabold text-4xl md:text-5xl text-white mb-4">
            Join the future of streaming
          </h2>
          <p className="reveal reveal-delay-2 text-white/45 text-base max-w-lg mx-auto leading-relaxed">
            StreamFi is more than a platform, it&apos;s a movement of creators, viewers, and Web3
            enthusiasts building the future together.
          </p>
        </div>

        {/* Stats */}
        <div className="reveal grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
          {stats.map((stat, i) => (
            <div
              key={i}
              className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6 text-center hover:border-purple-500/20 hover:bg-white/[0.05] transition-all duration-300"
            >
              <p className="font-pp-neue font-bold text-3xl md:text-4xl text-white mb-1 tabular-nums">
                {counts[i]}
                {stat.suffix}
              </p>
              <p className="text-white/40 text-xs tracking-wide">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Social channels */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {socials.map((s, i) => (
            <a
              key={i}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`reveal reveal-delay-${i + 1} group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br ${s.bg} to-transparent p-6 ${s.hoverBorder} hover:bg-white/[0.05] transition-all duration-300`}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-white/[0.08] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
                  <Image
                    src={s.icon}
                    alt={s.name}
                    width={18}
                    height={18}
                    className="w-[18px] h-[18px] object-contain opacity-80"
                  />
                </div>
                <div>
                  <p className="text-white text-sm font-semibold leading-none mb-1">{s.name}</p>
                  <p className="text-white/35 text-xs">{s.handle}</p>
                </div>
              </div>
              <p className="text-white/40 text-xs leading-relaxed mb-4">{s.desc}</p>
              <div className="flex items-center gap-1 text-purple-400 text-xs font-medium group-hover:gap-2 transition-all duration-200">
                Join community
                <span className="group-hover:translate-x-1 transition-transform duration-200 inline-block">
                  →
                </span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
