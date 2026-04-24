"use client";

import Image from "next/image";
import { testimonial_content } from "@/data/landing-page/testimonial";

// Duplicate items for seamless infinite loop
const row1 = [...testimonial_content, ...testimonial_content];
const row2 = [...testimonial_content]
  .reverse()
  .concat([...testimonial_content].reverse());

export default function Testimonials() {
  return (
    <section id="testimonials" className="py-24 overflow-hidden">
      {/* Heading */}
      <div className="max-w-6xl mx-auto px-4 text-center mb-14">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 text-xs font-medium mb-6">
          Testimonials
        </div>
        <h2 className="font-pp-neue font-extrabold text-4xl md:text-5xl text-white mb-3">
          Don&apos;t just take our word for it
        </h2>
        <p className="text-white/45 text-base">
          Hear from StreamFi&apos;s growing community of creators
        </p>
      </div>

      {/* Row 1 — left to right */}
      <div className="relative mb-4">
        <EdgeFade />
        <div className="marquee-track gap-4">
          {row1.map((item, i) => (
            <TestimonialCard key={`r1-${i}`} image={item.image} />
          ))}
        </div>
      </div>

      {/* Row 2 — right to left */}
      <div className="relative">
        <EdgeFade />
        <div className="marquee-track-reverse gap-4">
          {row2.map((item, i) => (
            <TestimonialCard key={`r2-${i}`} image={item.image} />
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialCard({ image }: { image: string }) {
  return (
    <div className="flex-shrink-0 w-72 h-44 rounded-2xl overflow-hidden border border-white/[0.07] bg-white/[0.03] hover:border-white/15 transition-colors duration-300">
      <Image
        src={image}
        alt="Testimonial"
        width={288}
        height={176}
        className="w-full h-full object-cover"
      />
    </div>
  );
}

function EdgeFade() {
  return (
    <>
      <div className="absolute left-0 top-0 bottom-0 w-24 sm:w-40 bg-gradient-to-r from-[#07060f] to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-24 sm:w-40 bg-gradient-to-l from-[#07060f] to-transparent z-10 pointer-events-none" />
    </>
  );
}
