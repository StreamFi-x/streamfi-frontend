// hooks/useProfileModal.ts

import { useState } from "react";
import { useAccount } from "@starknet-react/core";

export function useProfileModal(
  onNextStep: (step: "profile" | "verify" | "success") => void,
  refreshUser?: () => Promise<any>
) {
  const { address } = useAccount();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");

  const [emailError, setEmailError] = useState("");
  const [nameError, setNameError] = useState("");
  const [registrationError, setRegistrationError] = useState("");
  const [codeError, setCodeError] = useState("");

  const [isLoading, setIsLoading] = useState(false);

  const [verificationCode, setVerificationCode] = useState([
    "",
    "",
    "",
    "",
    "",
    "",
  ]);

  const resetErrors = () => {
    setEmailError("");
    setNameError("");
    setRegistrationError("");
    setCodeError("");
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetErrors();

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

    if (!isValid) return;

    setIsLoading(true);

    try {
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

      const result = await response.json();

      if (response.ok) {
        sessionStorage.setItem("wallet", address ?? "");
        localStorage.setItem("wallet", address ?? "");
        onNextStep("success");
      } else {
        setRegistrationError(result.error || "Registration failed");
      }
    } catch (error) {
      setRegistrationError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
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
    if (value.length > 1) value = value.charAt(0);

    const newCode = [...verificationCode];
    newCode[index] = value;
    setVerificationCode(newCode);

    if (value && index < 5) {
      const nextInput = document.getElementById(`code-${index + 1}`);
      nextInput?.focus();
    }
  };

  return {
    displayName,
    email,
    bio,
    emailError,
    nameError,
    registrationError,
    isLoading,
    verificationCode,
    codeError,
    setDisplayName,
    setEmail,
    setBio,
    handleProfileSubmit,
    handleVerifySubmit,
    handleCodeChange,
  };
}
