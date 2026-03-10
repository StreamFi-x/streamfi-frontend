"use client";

import { useEffect, useRef } from "react";

const cards = [
  {
    icon: "◈",
    title: "Decentralized Monetization",
    description:
      "No middlemen. You keep 100% of your earnings. StreamFi enables direct peer-to-peer transactions, creators receive every dollar with zero corporate cuts.",
    tag: "100% yours",
    borderHover: "hover:border-purple-500/30",
    badgeClass: "bg-purple-500/10 text-purple-300 border-purple-500/20",
    iconClass: "text-purple-400",
    glowColor: "rgba(124,58,237,0.18)",
  },
  {
    icon: "✦",
    title: "Ad-Free Experience",
    description:
      "Enjoy uninterrupted, high-quality streaming. Monetize through subscriptions, tips, and staking, not ads. Ever.",
    tag: "Zero interruptions",
    borderHover: "hover:border-blue-500/30",
    badgeClass: "bg-blue-500/10 text-blue-300 border-blue-500/20",
    iconClass: "text-blue-400",
    glowColor: "rgba(59,130,246,0.15)",
  },
  {
    icon: "⚡",
    title: "Direct Fan Engagement",
    description:
      "Fans aren't just viewers, they're active supporters who tip, subscribe, and vote. Build a community that owns a piece of your success.",
    tag: "Creator-first",
    borderHover: "hover:border-fuchsia-500/30",
    badgeClass: "bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/20",
    iconClass: "text-fuchsia-400",
    glowColor: "rgba(217,70,239,0.15)",
  },
  {
    icon: "⬡",
    title: "Community-Driven Governance",
    description:
      "Have a real say in StreamFi's future. Unlike centralized platforms, StreamFi is community-owned through DAO governance, no surprise policy changes.",
    tag: "DAO powered",
    borderHover: "hover:border-violet-500/30",
    badgeClass: "bg-violet-500/10 text-violet-300 border-violet-500/20",
    iconClass: "text-violet-400",
    glowColor: "rgba(139,92,246,0.18)",
  },
];

export default function Benefits() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.querySelectorAll<HTMLElement>(".reveal").forEach((el, i) => {
              setTimeout(() => el.classList.add("visible"), i * 90);
            });
          }
        });
      },
      { threshold: 0.08 }
    );
    if (sectionRef.current) {observer.observe(sectionRef.current);}
    return () => observer.disconnect();
  }, []);

  return (
    <section id="benefits" className="py-24 px-4" ref={sectionRef}>
      <div className="max-w-6xl mx-auto">
        {/* Heading */}
        <div className="text-center mb-16">
          <div className="reveal inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 text-xs font-medium mb-6">
            Why StreamFi
          </div>
          <h2 className="reveal reveal-delay-1 font-pp-neue font-extrabold text-4xl md:text-5xl lg:text-6xl text-white leading-tight mb-5">
            Built different.
            <br />
            <span className="text-gradient-purple">For creators.</span>
          </h2>
          <p className="reveal reveal-delay-2 text-white/45 text-base max-w-xl mx-auto leading-relaxed">
            Everything you need to stream, earn, and grow without the platform taking its cut.
          </p>
        </div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cards.map((card, i) => (
            <BentoCard key={i} card={card} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function BentoCard({
  card,
  index,
}: {
  card: (typeof cards)[number];
  index: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) {return;}
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    el.style.setProperty("--glow-x", `${x}px`);
    el.style.setProperty("--glow-y", `${y}px`);
    el.style.setProperty("--glow-opacity", "1");
  };

  const handleMouseLeave = () => {
    const el = cardRef.current;
    if (el) {el.style.setProperty("--glow-opacity", "0");}
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`reveal reveal-delay-${index + 1} relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8 ${card.borderHover} hover:bg-white/[0.045] transition-all duration-300 cursor-default`}
      style={
        {
          "--glow-x": "50%",
          "--glow-y": "50%",
          "--glow-opacity": "0",
        } as React.CSSProperties
      }
    >
      {/* Mouse-follow glow */}
      <div
        className="absolute inset-0 pointer-events-none rounded-2xl transition-opacity duration-300"
        style={{
          background: `radial-gradient(300px circle at var(--glow-x) var(--glow-y), ${card.glowColor}, transparent 70%)`,
          opacity: "var(--glow-opacity)" as unknown as number,
        }}
      />

      {/* Top row */}
      <div className="relative flex items-start justify-between mb-6">
        <span className={`text-3xl leading-none ${card.iconClass}`}>{card.icon}</span>
        <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full border ${card.badgeClass}`}>
          {card.tag}
        </span>
      </div>

      {/* Copy */}
      <h3 className="relative font-pp-neue font-bold text-xl text-white mb-3 leading-snug">
        {card.title}
      </h3>
      <p className="relative text-white/50 text-sm leading-relaxed">{card.description}</p>
    </div>
  );
}
