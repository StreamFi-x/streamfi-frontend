"use client";

import type React from "react";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { toast } from "sonner";

const avatars = [
  "/Images/waitlist1.png",
  "/Images/waitlist2.png",
  "/Images/waitlist3.png",
  "/Images/waitlist4.png",
];

interface WaitlistProps {
  initialCount?: number;
  onSubmit?: (email: string) => Promise<void>;
}

export default function Waitlist({ initialCount = 3000, onSubmit }: WaitlistProps) {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [showError, setShowError] = useState(false);
  const [showErrorStyling, setShowErrorStyling] = useState(false);
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.querySelectorAll<HTMLElement>(".reveal").forEach((el, i) => {
              setTimeout(() => el.classList.add("visible"), i * 100);
            });
          }
        });
      },
      { threshold: 0.1 }
    );
    if (sectionRef.current) {observer.observe(sectionRef.current);}
    return () => observer.disconnect();
  }, []);

  const validateEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);

  useEffect(() => {
    if (!emailTouched) {return;}
    let error = "";
    if (!email) {error = "Email is required";}
    else if (!validateEmail(email)) {error = "Please enter a valid email address";}
    setEmailError(error);
    if (error) {
      setShowError(true);
      setShowErrorStyling(true);
      if (errorTimeoutRef.current) {clearTimeout(errorTimeoutRef.current);}
      errorTimeoutRef.current = setTimeout(() => {
        setShowError(false);
        setShowErrorStyling(false);
      }, 3000);
    }
    return () => {
      if (errorTimeoutRef.current) {clearTimeout(errorTimeoutRef.current);}
    };
  }, [email, emailTouched]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailTouched(true);
    if (!email || !validateEmail(email)) {
      const error = email ? "Please enter a valid email address" : "Email is required";
      setEmailError(error);
      setShowError(true);
      setShowErrorStyling(true);
      if (errorTimeoutRef.current) {clearTimeout(errorTimeoutRef.current);}
      errorTimeoutRef.current = setTimeout(() => {
        setShowError(false);
        setShowErrorStyling(false);
      }, 3000);
      return;
    }
    setIsSubmitting(true);
    try {
      if (onSubmit) {
        await onSubmit(email);
      } else {
        const response = await fetch("/api/waitlist/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        let data;
        const text = await response.text();
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error("Server returned an invalid response format");
        }
        if (!response.ok) {
          let msg = data?.error || "Failed to join waitlist";
          if (response.status === 429) {msg = "Too many attempts. Please try again later.";}
          else if (response.status === 400) {msg = data?.error || "Invalid email format";}
          else if (response.status === 500) {msg = "Server error. Our team has been notified.";}
          throw new Error(msg);
        }
        if (data?.alreadySubscribed) {
          toast.info("You're already on our waitlist!", {
            description: "We'll notify you when StreamFi launches.",
            duration: 5000,
          });
          setIsSubmitted(true);
          setEmail("");
          setEmailTouched(false);
          setShowError(false);
          setShowErrorStyling(false);
          setTimeout(() => setIsSubmitted(false), 3000);
          setIsSubmitting(false);
          return;
        }
      }
      toast.success("You've been added to the waitlist!", {
        description: "We'll notify you when StreamFi launches.",
        duration: 5000,
      });
      setIsSubmitted(true);
      setEmail("");
      setEmailTouched(false);
      setShowError(false);
      setShowErrorStyling(false);
      setTimeout(() => setIsSubmitted(false), 3000);
    } catch (error) {
      toast.error("Failed to join the waitlist", {
        description: error instanceof Error ? error.message : "Please try again later.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="waitlist" className="py-24 px-4 relative overflow-hidden" ref={sectionRef}>
      {/* Large glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(124,58,237,0.12), rgba(59,130,246,0.04) 50%, transparent 70%)",
        }}
      />

      <div className="max-w-3xl mx-auto relative z-10 text-center">
        {/* Badge */}
        <div className="reveal inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 text-xs font-medium mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
          Early Access, Limited Spots
        </div>

        {/* Headline */}
        <h2 className="reveal reveal-delay-1 font-pp-neue font-extrabold text-4xl sm:text-5xl md:text-6xl text-white leading-tight mb-5">
          Join the Revolution.
          <br />
          <span className="text-gradient-purple">Own the Future.</span>
        </h2>

        <p className="reveal reveal-delay-2 text-white/50 text-base max-w-xl mx-auto leading-relaxed mb-10">
          Sign up for early access and be among the first to explore StreamFi&apos;s decentralized
          streaming platform. Get exclusive perks, early feature access, and shape the future
          of streaming.
        </p>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="reveal reveal-delay-3 flex flex-col sm:flex-row gap-3 max-w-lg mx-auto mb-8"
        >
          <div className="relative flex-1">
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setEmailTouched(true)}
              placeholder="Enter your email address"
              className={`w-full py-3.5 px-4 bg-white/[0.06] border rounded-xl text-white text-sm placeholder-white/30 focus:outline-none focus:ring-2 transition-all duration-200 ${
                showErrorStyling
                  ? "border-red-500/50 focus:ring-red-500/30"
                  : "border-white/10 focus:ring-purple-500/30 focus:border-purple-500/40"
              }`}
            />
            {emailError && emailTouched && showError && (
              <p className="absolute -bottom-5 left-0 text-red-400 text-xs">{emailError}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`flex-shrink-0 px-6 py-3.5 text-sm font-semibold rounded-xl transition-all duration-200 ${
              isSubmitted
                ? "bg-green-600 text-white"
                : "bg-white text-[#07060f] hover:bg-white/90 active:scale-95"
            } disabled:opacity-60 disabled:cursor-not-allowed`}
          >
            {isSubmitting ? "Joining…" : isSubmitted ? "✓ Joined!" : "Join the Waitlist"}
          </button>
        </form>

        {/* Social proof */}
        <div className="reveal reveal-delay-4 flex items-center justify-center gap-3">
          <div className="flex -space-x-2">
            {avatars.map((src, i) => (
              <Image
                key={i}
                src={src}
                alt=""
                width={32}
                height={32}
                className="w-8 h-8 rounded-full border-2 border-[#07060f] object-cover"
              />
            ))}
          </div>
          <p className="text-sm text-white/40">
            <span className="text-white/70 font-medium">{initialCount.toLocaleString()}+</span>{" "}
            creators and viewers already joined
          </p>
        </div>
      </div>
    </section>
  );
}
