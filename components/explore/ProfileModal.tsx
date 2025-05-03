"use client";

import type React from "react";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import Button from "../ui/Button";
import Image from "next/image";
import { VerifySuccess } from "@/public/icons";
import { ConnectModalProps } from "@/types/explore";
import { useAccount } from "@starknet-react/core";
import SimpleLoader from "../ui/loader/simple-loader";

export default function ConnectModal({
  isOpen,
  currentStep,
  onClose,
  onNextStep,
}: ConnectModalProps) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [emailError, setEmailError] = useState("");
  const [nameError, setNameError] = useState("");
  const [registrationError, setRegistrationError] = useState("");
  const { address } = useAccount();

  const [verificationCode, setVerificationCode] = useState([
    "",
    "",
    "",
    "",
    "",
    "",
  ]);
  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [codeError, setCodeError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();
  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    setEmailError("");
    setNameError("");

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
      // onNextStep("verify"); //skipping the verification step for now
      setIsLoading(true);
      const formData = {
        username: displayName,
        email: email,
        wallet: address,
      };
      fetch("/api/users/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      }).then(async (res) => {
        if (res.ok) {
          setRegistrationError("");
          onNextStep("success");
        }
        const result = await res.json();
        if (result.error) setRegistrationError(result.error);
        setIsLoading(false);
      });
    }
  };

  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();

    setCodeError("");

    if (verificationCode.some((digit) => !digit)) {
      setCodeError("Please enter the complete verification code");
      return;
    }
    onNextStep("success");
  };

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) {
      value = value.charAt(0);
    }

    const newCode = [...verificationCode];
    newCode[index] = value;
    setVerificationCode(newCode);

    if (value && index < 5) {
      codeInputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !verificationCode[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
  };

  useEffect(() => {
    if (currentStep === "verify") {
      codeInputRefs.current[0]?.focus();
    }
  }, [currentStep]);

  const modalVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        type: "spring",
        damping: 25,
        stiffness: 300,
      },
    },
    exit: {
      opacity: 0,
      scale: 0.9,
      transition: {
        duration: 0.2,
      },
    },
  };

  const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/70 z-40"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={overlayVariants}
          />

          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <motion.div
              className={` ${
                currentStep === "profile"
                  ? "max-w-4xl"
                  : currentStep === "verify"
                    ? "max-w-md"
                    : "max-w-md"
              } bg-background-2 rounded-lg max-w-4xl w-full  overflow-hidden`}
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={modalVariants}
            >
              {currentStep === "profile" && (
                <div className="p-6 flex flex-col gap-10 w-full max-w-4xl ">
                  <div>
                    <h2 className="text-2xl font-semibold text-primary mb-2">
                      Complete Your Profile
                    </h2>
                    <p className="text-offWhite-2 text-sm">
                      Set up your profile to get the best experience on Streamfi
                    </p>
                  </div>
                  {registrationError && (
                    <p className="text-red-500 text-xs">{registrationError}</p>
                  )}
                  <form onSubmit={handleProfileSubmit}>
                    <div className="space-y-5">
                      <div className="flex flex-col gap-2">
                        <label className="block text-sm text-offWhite-2 font-medium ">
                          Display Name{" "}
                          {nameError && (
                            <p className="text-red-500 text-xs">{nameError}</p>
                          )}
                        </label>
                        <input
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          className="w-full bg-grayish/10 rounded-md px-3 py-4 outline-none duration-200 text-xs font-light text-offWhite-2 focus:outline-none focus:ring-1 focus:ring-purple-500"
                          placeholder="Enter your display name"
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <label className="block text-sm font-medium  text-offWhite-2">
                          Email Address
                          {emailError && (
                            <p className="text-red-500 text-xs ">
                              {emailError}
                            </p>
                          )}
                        </label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full bg-grayish/10 rounded-md px-3 py-4 outline-none duration-200 text-xs font-light text-offWhite-2 focus:outline-none focus:ring-1 focus:ring-purple-500"
                          placeholder="Enter a valid email address"
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <label className="block text-sm font-medium  text-offWhite-2">
                          Bio (optional)
                        </label>
                        <textarea
                          value={bio}
                          onChange={(e) => setBio(e.target.value)}
                          className="w-full bg-grayish/10 rounded-md px-3 py-4 outline-none duration-200 text-xs font-light text-offWhite-2 focus:outline-none focus:ring-1 focus:ring-purple-500 min-h-[80px]"
                          placeholder="Tell your audience a bit about yourself"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-primary hover:bg-primary/70 text-white font-medium py-2 rounded-md mt-6 transition-colors"
                    >
                      Confirm
                    </button>
                  </form>
                </div>
              )}

              {currentStep === "verify" && (
                <div className="p-6 max-w-md">
                  <div className="flex flex-col justify-center gap-4 mb-4">
                    <button
                      onClick={() => onNextStep("profile")}
                      className="p-1 flex items-center gap-3 mr-2 rounded-full hover:bg-grayish/10"
                    >
                      <ChevronLeft size={24} />
                      Back
                    </button>
                    <h2 className="text-2xl text-center font-semibold text-primary">
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
                          ref={(el) => {
                            codeInputRefs.current[index] = el;
                          }}
                          type="text"
                          maxLength={1}
                          value={verificationCode[index]}
                          onChange={(e) =>
                            handleCodeChange(index, e.target.value)
                          }
                          onKeyDown={(e) => handleKeyDown(index, e)}
                          className="w-12 h-12 text-center bg-background-3 rounded-md outline-none duration-200 text-xl font-light text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
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
                      className="w-full bg-primary hover:bg-purple-700 text-white font-medium py-3  rounded-md mb-3 transition-colors"
                    >
                      Verify
                    </button>

                    <div className="text-center">
                      <p className="text-base text-white/50 font-normal">
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
                    <Image
                      src={VerifySuccess}
                      alt="Verification success logo"
                    />
                  </div>

                  <h2 className="text-2xl font-normal mb-4">
                    Verification Successful!
                  </h2>
                  <p className="text-offWhite-2 font-light text-center mb-8">
                    Your account has been successfully verified. Welcome to
                    Streamfi!
                  </p>

                  <div className="space-y-3">
                    <Button
                      onClick={onClose}
                      className="w-full bg-primary hover:bg-purple-700 text-white font-semibo py-3 rounded-md transition-colors"
                    >
                      Continue
                    </Button>

                    <Button
                      onClick={() => {
                        onClose();
                        router.push("/settings");
                        // Here you would add navigation to dashboard/settings
                      }}
                      className="w-full bg-[#333333] hover:bg-gray-700 text-white font-semibold  py-3 rounded-md transition-colors"
                    >
                      Go to Dashboard
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>

          {isLoading && <SimpleLoader />}
        </>
      )}
    </AnimatePresence>
  );
}
