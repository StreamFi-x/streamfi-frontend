"use client";

import type React from "react";

import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { MdClose } from "react-icons/md";
import { useRouter } from "next/navigation";
import { useAccount } from "@starknet-react/core";
import SimpleLoader from "@/components/ui/loader/simple-loader";

interface ProfileModalProps {
  isOpen: boolean;
  currentStep: "profile" | "verify" | "success";
  onClose: () => void;
  onNextStep: (step: "profile" | "verify" | "success") => void;
  walletAddress?: string;
  setIsProfileModalOpen: (open: boolean) => void;
}

export default function ProfileModal({
  isOpen,
  currentStep,
  onNextStep,
  walletAddress = "",
  setIsProfileModalOpen,
}: ProfileModalProps) {
  // Form state
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");

  // Error state
  const [emailError, setEmailError] = useState("");
  const [nameError, setNameError] = useState("");
  const [registrationError, setRegistrationError] = useState("");

  // Loading state
  const [isLoading, setIsLoading] = useState(false);

  // Router and wallet
  const router = useRouter();
  const { address } = useAccount();

  // Verification code state
  const [verificationCode, setVerificationCode] = useState([
    "",
    "",
    "",
    "",
    "",
    "",
  ]);
  const [codeError, setCodeError] = useState("");

  // Handle profile form submission
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Reset errors
    setEmailError("");
    setNameError("");
    setRegistrationError("");

    // Validate form
    let isValid = true;

    if (!displayName.trim()) {
      setNameError("Display name is required");
      isValid = false;
    }

    if (!email.trim()) {
      setEmailError("Email address is required");
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError("Please enter a valid email address");
      isValid = false;
    }

    if (isValid) {
      setIsLoading(true);

      try {
        console.log("ProfileModal: Registering user with wallet:", address);

        const formData = {
          username: displayName,
          email: email,
          wallet: address,
          bio: bio || undefined,
        };

        const response = await fetch("/api/users/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        });

        console.log(
          "ProfileModal: Registration response status:",
          response.status,
        );
        const result = await response.json();

        if (response.ok) {
          console.log("ProfileModal: Registration successful");

          // Store wallet and username in localStorage for persistence
          localStorage.setItem("wallet", address || "");
          localStorage.setItem("username", displayName);

          // Also store in sessionStorage for redundancy
          sessionStorage.setItem("wallet", address || "");
          sessionStorage.setItem("username", displayName);

          // Skip verification for now and go straight to success
          onNextStep("success");
        } else {
          console.error("ProfileModal: Registration failed:", result.error);
          setRegistrationError(result.error || "Registration failed");
        }
      } catch (error) {
        console.error("ProfileModal: Registration error:", error);
        setRegistrationError("An unexpected error occurred");
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Handle verification form submission
  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCodeError("");

    if (verificationCode.some((digit) => !digit)) {
      setCodeError("Please enter the complete verification code");
      return;
    }

    // In a real app, you would verify the code with your backend
    onNextStep("success");
  };

  // Handle verification code input
  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) {
      value = value.charAt(0);
    }

    const newCode = [...verificationCode];
    newCode[index] = value;
    setVerificationCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`code-${index + 1}`);
      if (nextInput) {
        nextInput.focus();
      }
    }
  };

  // Handle modal close
  const handleProfileModalClose = () => {
    setIsProfileModalOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70"
        onClick={handleProfileModalClose}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className={`bg-[#1A1A1A] rounded-lg w-full ${
          currentStep === "profile" ? "max-w-4xl" : "max-w-md"
        } overflow-hidden z-10`}
      >
        {currentStep === "profile" && (
          <div className="p-6 flex flex-col gap-10 w-full max-w-4xl">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-semibold text-white mb-2">
                  Complete Your Profile
                </h2>
                <p className="text-gray-400 text-sm">
                  Set up your profile to get the best experience on Streamfi
                </p>
              </div>
              <button
                onClick={handleProfileModalClose}
                className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors rounded-full bg-[#383838] w-[30px] h-[30px] justify-center items-center flex"
              >
                <MdClose size={20} />
              </button>
            </div>

            {registrationError && (
              <p className="text-red-500 text-xs">{registrationError}</p>
            )}

            <form onSubmit={handleProfileSubmit}>
              <div className="space-y-5">
                <div className="flex flex-col gap-2">
                  <label className="block text-sm text-gray-400 font-medium">
                    Display Name{" "}
                    {nameError && (
                      <p className="text-red-500 text-xs">{nameError}</p>
                    )}
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-[#2D2F31] rounded-md px-3 py-4 outline-none duration-200 text-xs font-light text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                    placeholder="Enter your display name"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="block text-sm font-medium text-gray-400">
                    Email Address
                    {emailError && (
                      <p className="text-red-500 text-xs">{emailError}</p>
                    )}
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#2D2F31] rounded-md px-3 py-4 outline-none duration-200 text-xs font-light text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                    placeholder="Enter a valid email address"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="block text-sm font-medium text-gray-400">
                    Bio (optional)
                  </label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full bg-[#2D2F31] rounded-md px-3 py-4 outline-none duration-200 text-xs font-light text-white focus:outline-none focus:ring-1 focus:ring-purple-500 min-h-[80px]"
                    placeholder="Tell your audience a bit about yourself"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 rounded-md mt-6 transition-colors disabled:opacity-50"
              >
                {isLoading ? "Creating Profile..." : "Confirm"}
              </button>
            </form>
          </div>
        )}

        {currentStep === "verify" && (
          <div className="p-6 max-w-md">
            <div className="flex flex-col justify-center gap-4 mb-4">
              <button
                onClick={() => onNextStep("profile")}
                className="p-1 flex items-center gap-3 mr-2 rounded-full hover:bg-gray-800"
              >
                <ChevronLeft size={24} />
                Back
              </button>
              <h2 className="text-2xl text-center font-semibold text-white">
                Verify Your Email
              </h2>
            </div>

            <p className="text-gray-400 text-base mb-6 font-normal text-center">
              Enter the 6-digit code sent to
              <span className="text-white"> {email}</span>.
              <br />
              This code is valid for 5 minutes.
            </p>

            <form onSubmit={handleVerifySubmit}>
              <div className="flex justify-center gap-3 mb-6">
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <input
                    key={index}
                    id={`code-${index}`}
                    type="text"
                    maxLength={1}
                    value={verificationCode[index]}
                    onChange={(e) => handleCodeChange(index, e.target.value)}
                    className="w-12 h-12 text-center bg-[#2D2F31] rounded-md outline-none duration-200 text-xl font-light text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                ))}
              </div>

              {codeError && (
                <p className="text-red-500 text-sm text-center mb-4">
                  {codeError}
                </p>
              )}

              <button
                type="submit"
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 rounded-md mb-3 transition-colors"
              >
                Verify
              </button>

              <div className="text-center">
                <p className="text-base text-gray-400 font-normal">
                  Didn&apos;t receive a code?{" "}
                  <button className="underline font-medium text-white underline-offset-2">
                    Resend
                  </button>
                </p>
              </div>
            </form>
          </div>
        )}

        {currentStep === "success" && (
          <div className="p-5 text-center max-w-md">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-8 w-8 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>

            <h2 className="text-2xl font-normal mb-4 text-white">
              Registration Successful!
            </h2>
            <p className="text-gray-400 font-light text-center mb-8">
              Your account has been successfully created. Welcome to Streamfi!
            </p>

            <div className="space-y-3">
              <button
                onClick={handleProfileModalClose}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-md transition-colors"
              >
                Continue
              </button>

              <button
                onClick={() => {
                  handleProfileModalClose();
                  router.push("/settings");
                }}
                className="w-full bg-[#333333] hover:bg-gray-700 text-white font-semibold py-3 rounded-md transition-colors"
              >
                Go to Settings
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {isLoading && <SimpleLoader />}
    </div>
  );
}
