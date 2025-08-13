"use client";

import type React from "react";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { toast } from "sonner";
import Section from "@/components/layout/Section";

interface WaitlistProps {
  initialCount?: number;
  onSubmit?: (email: string) => Promise<void>;
}

const Waitlist: React.FC<WaitlistProps> = ({
  initialCount = 3000,
  onSubmit,
}) => {
  const [email, setEmail] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [emailTouched, setEmailTouched] = useState<boolean>(false);
  const [emailError, setEmailError] = useState<string>("");
  const [showError, setShowError] = useState<boolean>(false);
  const [showErrorStyling, setShowErrorStyling] = useState<boolean>(false);
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const avatars: string[] = [
    "/Images/waitlist1.png",
    "/Images/waitlist2.png",
    "/Images/waitlist3.png",
    "/Images/waitlist4.png",
  ];

  // Validate email whenever it changes, but only show errors if the field has been touched
  useEffect(() => {
    if (!emailTouched) return;

    let error = "";
    if (!email) {
      error = "Email is required";
    } else if (!validateEmail(email)) {
      error = "Please enter a valid email address";
    }

    setEmailError(error);

    // Show error if there is one
    if (error) {
      setShowError(true);
      setShowErrorStyling(true);

      // Clear any existing timeout
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }

      // Set timeout to hide error after 3 seconds
      errorTimeoutRef.current = setTimeout(() => {
        setShowError(false);
        setShowErrorStyling(false);
      }, 3000);
    }

    return () => {
      // Clean up timeout on unmount or when email changes
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, [email, emailTouched]);

  // Custom email validation function
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Mark email as touched to trigger validation
    setEmailTouched(true);

    // Validate email before submission
    if (!email || !validateEmail(email)) {
      const error = email
        ? "Please enter a valid email address"
        : "Email is required";
      setEmailError(error);
      setShowError(true);
      setShowErrorStyling(true);

      // Clear any existing timeout
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }

      // Set timeout to hide error after 3 seconds
      errorTimeoutRef.current = setTimeout(() => {
        setShowError(false);
        setShowErrorStyling(false);
      }, 3000);

      return;
    }

    setIsSubmitting(true);

    try {
      if (onSubmit) {
        // Use the provided onSubmit handler if available
        await onSubmit(email);
      } else {
        console.log("Submitting to waitlist API:", email);

        // Call our API endpoint with better error handling
        const response = await fetch("/api/waitlist/subscribe", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email }),
        });

        console.log("API response status:", response.status);

        // Get response data with error handling
        let data;
        let responseText = "";

        try {
          // First try to get the response as text (to help debug HTML errors)
          responseText = await response.text();

          // Then try to parse as JSON
          try {
            data = JSON.parse(responseText);
            console.log("API response data:", data);
          } catch (jsonError) {
            console.error("Failed to parse response as JSON:", jsonError);
            console.log(
              "Response text (first 200 chars):",
              responseText.substring(0, 200)
            );
            throw new Error("Server returned an invalid response format");
          }
        } catch (responseError) {
          console.error("Error getting response:", responseError);
          throw new Error("Failed to process server response");
        }

        if (!response.ok) {
          let errorMessage = data?.error || "Failed to join waitlist";

          // Enhanced error handling
          if (response.status === 429) {
            errorMessage = "Too many attempts. Please try again later.";
          } else if (response.status === 400) {
            errorMessage = data?.error || "Invalid email format";
          } else if (response.status === 500) {
            errorMessage = "Server error. Our team has been notified.";
            console.error(
              "Server error details:",
              data?.details || "No details provided"
            );
          }

          throw new Error(errorMessage);
        }

        // Check for already subscribed
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

          setTimeout(() => {
            setIsSubmitted(false);
          }, 3000);

          setIsSubmitting(false);
          return;
        }
      }

      // Show success toast
      toast.success("You've been added to the waitlist!", {
        description: "We'll notify you when StreamFi launches.",
        duration: 5000,
      });

      setIsSubmitted(true);
      setEmail("");
      setEmailTouched(false);
      setShowError(false);
      setShowErrorStyling(false);

      setTimeout(() => {
        setIsSubmitted(false);
      }, 3000);
    } catch (error) {
      console.error("Error submitting email:", error);
      // Show error toast with specific message if available
      toast.error("Failed to join the waitlist", {
        description:
          error instanceof Error ? error.message : "Please try again later.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Section
      id="waitlist"
      className="relative flex flex-col items-center justify-center text-white"
      wrapperClassName="bg-gradient-to-b from-transparent to-background-2"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-8"
      >
        <h1 className="font-pp-neue font-extrabold text-2xl sm:text-4xl xl:text-5xl text-white mb-4 max-w-5xl">
          Join the Revolution: Own Your Stream, Own Your Earnings
        </h1>

        <p className="text-white/80 font-normal max-w-2xl mx-auto">
          Sign up for early access and be among the first to explore
          StreamFi&apos;s decentralized streaming platform. Get exclusive perks,
          early feature access, and shape the future of streaming!
        </p>
      </motion.div>

      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        onSubmit={handleSubmit}
        className="flex flex-col w-full max-w-2xl mx-auto mb-6 relative z-20"
      >
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center w-full">
          <div className="w-full md:max-w-md relative">
            <input
              type="text"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onBlur={() => setEmailTouched(true)}
              placeholder="Enter your email"
              className={`w-full py-3 px-4 bg-[#272526] rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-all duration-300 ${
                showErrorStyling
                  ? "focus:ring-red-500 border border-red-500"
                  : "focus:ring-purple-500"
              }`}
            />
            <AnimatePresence>
              {emailError && emailTouched && showError && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-red-500 text-sm mt-1 absolute"
                >
                  {emailError}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={isSubmitting}
            className={`w-full sm:w-[11rem] text-center py-3 px-6 bg-[#5A189A] hover:bg-purple-700 rounded-lg text-white font-medium transition-colors duration-300 ${
              isSubmitting ? "opacity-70 cursor-not-allowed" : ""
            }`}
          >
            {isSubmitting
              ? "Joining..."
              : isSubmitted
                ? "Joined!"
                : "Join the Waitlist"}
          </motion.button>
        </div>
      </motion.form>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="flex flex-col sm:flex-row items-center justify-center gap-2 text-gray-300"
      >
        <div className="flex -space-x-2">
          {avatars.map((avatar, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + index * 0.1 }}
            >
              <Image
                src={avatar || "/placeholder.svg"}
                alt={`User ${index + 1}`}
                width={32}
                height={32}
                className="w-8 h-8 md:text-base text-[8px] rounded-full border-2 border-gray-800"
              />
            </motion.div>
          ))}
        </div>
        <span>{initialCount}+ creators and viewers Joined!</span>
      </motion.div>

      <div className="flex justify-center pointer-events-none overflow-hidden opacity-20">
        <p
          className="text-[4rem] md:text-[12rem] font-extrabold p-0 m-0"
          style={{
            color: "rgba(255, 255, 255, 0.1)",
            WebkitTextStroke: "0.8px #f1f1f1",
            textShadow: "2px 2px 4px rgba(0, 0, 0, 0.5)",
          }}
        >
          Waitlist
        </p>
      </div>

      <div
        className="absolute bottom-0 inset-0 bg-[url('/Images/waitlist.png')] bg-cover bg-center opacity-20 pointer-events-none"
        style={{ bottom: "-24px" }}
      ></div>
    </Section>
  );
};

export default Waitlist;
