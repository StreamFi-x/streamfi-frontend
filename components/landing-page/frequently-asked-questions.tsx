"use client";

import { useState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { frequentlyAskedQuestions } from "@/data/landing-page/frequentlyAskedQuestions";

export default function FrequentlyAskedQuestions() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.querySelectorAll<HTMLElement>(".reveal").forEach((el, i) => {
              setTimeout(() => el.classList.add("visible"), i * 70);
            });
          }
        });
      },
      { threshold: 0.08 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="frequently-asked-questions" className="py-24 px-4" ref={sectionRef}>
      <div className="max-w-3xl mx-auto">
        {/* Heading */}
        <div className="text-center mb-14">
          <div className="reveal inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 text-xs font-medium mb-6">
            FAQ
          </div>
          <h2 className="reveal reveal-delay-1 font-pp-neue font-extrabold text-4xl md:text-5xl text-white mb-4">
            Frequently asked
            <br />
            <span className="text-gradient-purple">questions</span>
          </h2>
          <p className="reveal reveal-delay-2 text-white/45 text-base max-w-md mx-auto leading-relaxed">
            Everything you need to know about StreamFi, from getting started to maximizing your
            earnings.
          </p>
        </div>

        {/* Accordion */}
        <div className="space-y-2.5">
          {frequentlyAskedQuestions.map((faq, i) => {
            const isOpen = activeId === faq.id;
            return (
              // Outer wrapper holds the reveal class — untouched by state changes
              // so IntersectionObserver's classList.add("visible") is never overwritten
              <div key={faq.id} className={`reveal reveal-delay-${i + 1}`}>
              <div
                className={`rounded-2xl border overflow-hidden transition-all duration-300 ${
                  isOpen
                    ? "border-purple-500/25 bg-purple-950/25"
                    : "border-white/[0.07] bg-white/[0.03] hover:border-white/13"
                }`}
              >
                <button
                  className="w-full flex items-center justify-between px-5 py-4 text-left gap-4"
                  onClick={() => setActiveId(isOpen ? null : faq.id)}
                  aria-expanded={isOpen}
                >
                  <span className="text-white text-sm font-medium leading-snug">{faq.title}</span>
                  <div
                    className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center border transition-all duration-300 ${
                      isOpen
                        ? "border-purple-500/40 bg-purple-500/15 rotate-45"
                        : "border-white/15 bg-white/[0.04]"
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5 text-white/60" />
                  </div>
                </button>

                {/* Answer */}
                <div
                  className="overflow-hidden transition-all duration-300 ease-in-out"
                  style={{ maxHeight: isOpen ? "300px" : "0px" }}
                >
                  <p className="px-5 pb-5 text-white/50 text-sm leading-relaxed">{faq.content}</p>
                </div>
              </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
