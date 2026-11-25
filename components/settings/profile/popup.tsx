import React, { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";

interface VerificationPopupProps {
  email: string;
  onClose: () => void;
  onVerify: (code: string) => void;
}

const VerificationPopup: React.FC<VerificationPopupProps> = ({
  email,
  onClose,
  onVerify,
}) => {
  const [verificationCode, setVerificationCode] = useState<string[]>(
    Array(6).fill("")
  );
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "Tab") {
        if (!dialogRef.current) return;
        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const focusable = Array.from(focusableElements).filter(
          el => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true"
        );

        if (focusable.length === 0) return;

        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const handleInputChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) {
      return;
    }

    const newCode = [...verificationCode];
    newCode[index] = value;
    setVerificationCode(newCode);

    if (value && index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleInputKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && !verificationCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleFocus = (index: number) => {
    setFocusedIndex(index);
  };

  const handleBlur = () => {
    setFocusedIndex(null);
  };

  const handleVerify = () => {
    const code = verificationCode.join("");
    if (code.length === 6) {
      onVerify(code);
      onClose();
    }
  };

  const handleResend = () => {
    console.log("Resending code to", email);
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={e => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="verification-dialog-title"
        aria-describedby="verification-dialog-desc"
        className="bg-[#1a1a1a] rounded-lg p-8 max-w-md w-full mx-4 relative"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close verification popup"
          className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-md transition focus:outline-none focus:ring-2 focus:ring-[#5A189A]"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>

        <h2
          id="verification-dialog-title"
          className="text-white text-2xl font-bold text-center mb-4"
        >
          Enter Verification code
        </h2>

        <p id="verification-dialog-desc" className="text-gray-400 text-center mb-2">
          Enter the 6-digit code sent to
        </p>
        <p className="text-white text-center font-medium mb-6">
          {email}.{" "}
          <span className="text-gray-400">
            This code is valid for 5 minutes.
          </span>
        </p>

        <div className="flex justify-center gap-2 mb-8">
          {verificationCode.map((digit, index) => (
            <input
              key={index}
              type="text"
              maxLength={1}
              value={digit}
              aria-label={`Digit ${index + 1} of 6`}
              ref={el => {
                inputRefs.current[index] = el;
              }}
              onChange={e => handleInputChange(index, e.target.value)}
              onKeyDown={e => handleInputKeyDown(index, e)}
              onFocus={() => handleFocus(index)}
              onBlur={handleBlur}
              className={`
                w-12 h-12 
                bg-[#2a2a2a] 
                text-white 
                text-center 
                text-xl 
                rounded-md 
                outline-none 
                transition-all
                duration-150
                ${focusedIndex === index ? "border-2 border-[#5A189A]" : ""}
              `}
              style={{
                boxShadow:
                  focusedIndex === index
                    ? "0 0 0 2px rgba(90, 24, 154, 0.3)"
                    : "none",
              }}
            />
          ))}
        </div>

        <button
          onClick={handleVerify}
          className="w-full bg-[#5A189A] hover:bg-opacity-90 text-white py-3 rounded-md transition mb-4"
        >
          Verify
        </button>

        <div className="text-center">
          <span className="text-gray-400">Didn&apos;t receive a code?</span>{" "}
          <button onClick={handleResend} className="text-white underline">
            Resend
          </button>
        </div>
      </div>
    </div>
  );
};

export default VerificationPopup;
