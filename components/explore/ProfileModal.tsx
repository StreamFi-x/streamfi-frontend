"use client";

import type React from "react";

import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useStellarWallet } from "@/contexts/stellar-wallet-context";
import SimpleLoader from "@/components/ui/loader/simple-loader";

interface ProfileModalProps {
  isOpen: boolean;
  currentStep: "profile" | "verify" | "success";
  onClose: () => void;
  onNextStep: (step: "profile" | "verify" | "success") => void;
  walletAddress?: string;
  setIsProfileModalOpen: (open: boolean) => void;
  /** When "privy", uses the Google-auth onboarding flow instead of the wallet-connect flow */
  mode?: "wallet" | "privy";
  /** Pre-filled email from Privy/Google — read-only in privy mode */
  privyEmail?: string;
}

export default function ProfileModal({
  isOpen,
  currentStep,
  onNextStep,
  setIsProfileModalOpen,
  mode = "wallet",
  privyEmail,
}: ProfileModalProps) {
  const isPrivyMode = mode === "privy";
  // Form state
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState(privyEmail ?? "");
  const [bio, setBio] = useState("");

  // Error state
  const [emailError, setEmailError] = useState("");
  const [nameError, setNameError] = useState("");
  const [registrationError, setRegistrationError] = useState("");

  // Loading state
  const [isLoading, setIsLoading] = useState(false);

  // Router and wallet
  const router = useRouter();
  const { publicKey } = useStellarWallet();

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

    setEmailError("");
    setNameError("");
    setRegistrationError("");

    let isValid = true;

    if (!displayName.trim()) {
      setNameError("Display name is required");
      isValid = false;
    }

    // Email required only for wallet-connect users (Privy email comes from Google)
    if (!isPrivyMode) {
      if (!email.trim()) {
        setEmailError("Email address is required");
        isValid = false;
      } else if (!/\S+@\S+\.\S+/.test(email)) {
        setEmailError("Please enter a valid email address");
        isValid = false;
      }
    }

    if (!isValid) {return;}

    setIsLoading(true);

    try {
      if (isPrivyMode) {
        // ── Privy (Google) onboarding flow ──────────────────────────────────
        // Server reads the privy_session HttpOnly cookie — we send no identity
        const response = await fetch("/api/auth/onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ username: displayName, bio: bio || undefined }),
        });

        const result = await response.json();

        if (response.ok) {
          // Persist username for fast access
          sessionStorage.setItem("username", displayName);
          if (result.wallet) {
            sessionStorage.setItem(
              "privy_user",
              JSON.stringify({
                ...JSON.parse(sessionStorage.getItem("privy_user") ?? "{}"),
                username: displayName,
                wallet: result.wallet,
              })
            );
          }
          onNextStep("success");
        } else {
          setRegistrationError(result.error || "Registration failed");
        }
      } else {
        // ── Wallet-connect (Freighter) registration flow ─────────────────────
        const response = await fetch("/api/users/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: displayName,
            email,
            wallet: publicKey,
            bio: bio || undefined,
          }),
        });

        const result = await response.json();

        if (response.ok) {
          localStorage.setItem("wallet", publicKey || "");
          localStorage.setItem("username", displayName);
          sessionStorage.setItem("wallet", publicKey || "");
          sessionStorage.setItem("username", displayName);
          onNextStep("success");
        } else {
          setRegistrationError(result.error || "Registration failed");
        }
      }
    } catch {
      setRegistrationError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle verification form submission
  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCodeError("");

    if (verificationCode.some(digit => !digit)) {
      setCodeError("Please enter the complete verification code");
      return;
    }

    // In a real app, you would verify the code with your backend
    onNextStep("success");
  };

  // Handle verification code input — digits only, auto-advance
  const handleCodeChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const newCode = [...verificationCode];
    newCode[index] = digit;
    setVerificationCode(newCode);

    if (digit && index < 5) {
      document.getElementById(`code-${index + 1}`)?.focus();
    }
  };

  // Backspace on empty box → go back one
  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !verificationCode[index] && index > 0) {
      document.getElementById(`code-${index - 1}`)?.focus();
    }
  };

  // Paste — distribute digits across all 6 boxes at once
  const handleCodePaste = (e: React.ClipboardEvent<HTMLInputElement>, startIndex: number) => {
    e.preventDefault();
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6 - startIndex);
    if (!digits) {return;}
    const newCode = [...verificationCode];
    digits.split("").forEach((char, i) => {
      newCode[startIndex + i] = char;
    });
    setVerificationCode(newCode);
    const focusIndex = Math.min(startIndex + digits.length, 5);
    document.getElementById(`code-${focusIndex}`)?.focus();
  };

  // Handle modal close
  const handleProfileModalClose = () => {
    setIsProfileModalOpen(false);
  };

  if (!isOpen) {
    return null;
  }

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
                <X size={20} />
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
                    onChange={e => setDisplayName(e.target.value)}
                    className="w-full bg-[#2D2F31] rounded-md px-3 py-4 outline-none duration-200 text-xs font-light text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                    placeholder="Enter your display name"
                  />
                </div>

                {/* Email — read-only for Privy users (verified by Google), editable for wallet users */}
                <div className="flex flex-col gap-2">
                  <label className="block text-sm font-medium text-gray-400">
                    Email Address
                    {isPrivyMode && (
                      <span className="ml-2 text-xs text-green-400">✓ verified via Google</span>
                    )}
                    {emailError && (
                      <p className="text-red-500 text-xs">{emailError}</p>
                    )}
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => !isPrivyMode && setEmail(e.target.value)}
                    readOnly={isPrivyMode}
                    className={`w-full bg-[#2D2F31] rounded-md px-3 py-4 outline-none duration-200 text-xs font-light text-white focus:outline-none focus:ring-1 focus:ring-purple-500 ${isPrivyMode ? "opacity-60 cursor-not-allowed" : ""}`}
                    placeholder="Enter a valid email address"
                  />
                </div>

                {/* Custodial wallet notice — shown only for Privy users */}
                {isPrivyMode && (
                  <div className="rounded-md border border-yellow-600/40 bg-yellow-900/20 px-4 py-3 text-xs text-yellow-300">
                    <p className="font-semibold mb-1">A Stellar wallet will be created for you</p>
                    <p className="text-yellow-400/80">
                      StreamFi will generate and securely manage a Stellar wallet on your behalf.
                      You can export your private key from Settings at any time to take self-custody.
                    </p>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <label className="block text-sm font-medium text-gray-400">
                    Bio (optional)
                  </label>
                  <textarea
                    value={bio}
                    onChange={e => setBio(e.target.value)}
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
          <div className="p-8 w-full max-w-md mx-auto">
            {/* Header */}
            <div className="flex flex-col gap-3 mb-6">
              <button
                onClick={() => onNextStep("profile")}
                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors w-fit"
              >
                <ChevronLeft size={18} />
                <span className="text-sm">Back</span>
              </button>
              <h2 className="text-2xl font-semibold text-white">
                Verify your email
              </h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                Enter the 6-digit code sent to{" "}
                <span className="text-white font-medium">{email}</span>.
                {" "}Valid for 5 minutes.
              </p>
            </div>

            <form onSubmit={handleVerifySubmit}>
              {/* OTP inputs */}
              <div className="flex justify-between gap-2 mb-6">
                {[0, 1, 2, 3, 4, 5].map(index => (
                  <input
                    key={index}
                    id={`code-${index}`}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={1}
                    value={verificationCode[index]}
                    onChange={e => handleCodeChange(index, e.target.value)}
                    onKeyDown={e => handleCodeKeyDown(index, e)}
                    onPaste={e => handleCodePaste(e, index)}
                    onFocus={e => e.target.select()}
                    className={[
                      "w-full aspect-square max-w-[52px]",
                      "flex items-center justify-center text-center",
                      "appearance-none [color-scheme:dark]",
                      "bg-[#2D2F31] text-white caret-purple-400",
                      "text-xl font-semibold",
                      "rounded-lg border-2 transition-all duration-150",
                      "focus:outline-none",
                      verificationCode[index]
                        ? "border-purple-500"
                        : "border-transparent focus:border-purple-500",
                    ].join(" ")}
                  />
                ))}
              </div>

              {codeError && (
                <p className="text-red-400 text-sm text-center mb-4">
                  {codeError}
                </p>
              )}

              <button
                type="submit"
                disabled={verificationCode.some(d => !d)}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg mb-4 transition-colors"
              >
                Verify
              </button>

              <p className="text-sm text-gray-400 text-center">
                Didn&apos;t receive a code?{" "}
                <button
                  type="button"
                  className="text-white font-medium underline underline-offset-2 hover:text-purple-400 transition-colors"
                >
                  Resend
                </button>
              </p>
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
                onClick={() => {
                  if (isPrivyMode) {
                    router.push("/explore");
                  } else {
                    handleProfileModalClose();
                  }
                }}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-md transition-colors"
              >
                {isPrivyMode ? "Go to StreamFi" : "Continue"}
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
