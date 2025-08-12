"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { Check, ChevronDown, X, AlertTriangle, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  bgClasses,
  textClasses,
  borderClasses,
  buttonClasses,
  componentClasses,
  combineClasses,
} from "@/lib/theme-classes";

interface ToggleSwitchProps {
  enabled: boolean;
  onChange: () => void;
}

interface SectionCardProps {
  children: React.ReactNode;
  className?: string;
}

interface ToggleSectionProps {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  actionButton?: {
    text: string;
    onClick: () => void;
  };
}

interface DropdownProps {
  selected: string;
  options: string[];
  onSelect: (option: string) => void;
  label: string;
  description: string;
}

interface CheckboxProps {
  checked: boolean;
  onChange: () => void;
  label: string;
  description: string;
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  className?: string;
}

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "success" | "error" | "warning";
  title: string;
  message: string;
}

// Reusable Modal Component
const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  title,
  className = "",
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={combineClasses(
              bgClasses.overlay,
              "fixed inset-0 z-50 flex items-center justify-center p-4"
            )}
            onClick={onClose}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={combineClasses(
                componentClasses.modal,
                "max-w-md w-full max-h-[90vh] overflow-y-auto",
                className
              )}
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6">
                {title && (
                  <div className="flex justify-between items-center mb-4">
                    <h3
                      className={combineClasses(
                        textClasses.primary,
                        "text-lg font-semibold"
                      )}
                    >
                      {title}
                    </h3>
                    <button
                      onClick={onClose}
                      className={combineClasses(
                        textClasses.tertiary,
                        "hover:text-white transition-colors"
                      )}
                    >
                      <X size={20} />
                    </button>
                  </div>
                )}
                {children}
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// Feedback Modal Component
const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  type,
  title,
  message,
}) => {
  const icons = {
    success: <Check className="w-12 h-12 text-green-500 mx-auto" />,
    error: <X className="w-12 h-12 text-red-500 mx-auto" />,
    warning: <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto" />,
  };

  const colors = {
    success: textClasses.success,
    error: textClasses.error,
    warning: textClasses.warning,
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="text-center">
        {icons[type]}
        <h3
          className={combineClasses("text-lg font-semibold mt-4", colors[type])}
        >
          {title}
        </h3>
        <p className={combineClasses(textClasses.tertiary, "mt-2")}>
          {message}
        </p>
        <button
          onClick={onClose}
          className={combineClasses(
            buttonClasses.secondary,
            "w-full mt-6 px-4 py-2 rounded-lg"
          )}
        >
          Close
        </button>
      </div>
    </Modal>
  );
};

// Update the VerifyEmailModal component to use the actual API
const VerifyEmailModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  email: string;
  onSuccess: () => void;
}> = ({ isOpen, onClose, email, onSuccess }) => {
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "warning";
    title: string;
    message: string;
  } | null>(null);

  const handleCodeChange = (index: number, value: string) => {
    if (value.length <= 1) {
      const newCode = [...code];
      newCode[index] = value;
      setCode(newCode);

      // Auto-focus next input
      if (value && index < 5) {
        const nextInput = document.getElementById(`code-${index + 1}`);
        if (nextInput) nextInput.focus();
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      const prevInput = document.getElementById(`code-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  const handleSubmit = async () => {
    const verificationCode = code.join("");

    if (verificationCode.length !== 6) {
      setFeedback({
        type: "error",
        title: "Invalid Code",
        message: "Please enter the complete 6-digit verification code.",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Call the actual API endpoint to verify the email using the correct format from YAML
      const response = await fetch("/api/users/verify-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          token: verificationCode, // Changed from 'code' to 'token' as per YAML spec
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setFeedback({
          type: "success",
          title: "Email Verified!",
          message: "Your email address has been successfully verified.",
        });

        // Close modal after showing success
        setTimeout(() => {
          onClose();
          onSuccess();
          setCode(["", "", "", "", "", ""]);
          setFeedback(null);
        }, 2000);
      } else {
        // Handle different error status codes as per YAML
        let errorMessage =
          "The verification code is incorrect. Please try again.";

        if (response.status === 410) {
          errorMessage =
            "The verification code has expired. Please request a new one.";
        } else if (response.status === 404) {
          errorMessage = "User not found. Please check your email address.";
        } else if (data.message) {
          errorMessage = data.message;
        }

        setFeedback({
          type: "error",
          title: "Verification Failed",
          message: errorMessage,
        });
        setCode(["", "", "", "", "", ""]);
      }
    } catch (error) {
      console.error("Error verifying email:", error);
      setFeedback({
        type: "error",
        title: "Error",
        message: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    try {
      // Call the API to request a new verification code
      const response = await fetch("/api/request-email-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setFeedback({
          type: "success",
          title: "Code Sent",
          message: "A new verification code has been sent to your email.",
        });
      } else {
        const data = await response.json();
        setFeedback({
          type: "error",
          title: "Failed to Send Code",
          message:
            data.message ||
            "Failed to send verification code. Please try again.",
        });
      }
    } catch (error) {
      console.error("Error requesting verification code:", error);
      setFeedback({
        type: "error",
        title: "Error",
        message: "An unexpected error occurred. Please try again.",
      });
    }
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose}>
        <div className="text-center">
          <h3
            className={combineClasses(
              textClasses.primary,
              "text-lg font-semibold mb-2"
            )}
          >
            Verify Your Email
          </h3>

          <p className={combineClasses(textClasses.tertiary, "mb-6 text-sm")}>
            Enter the 6-digit code sent to{" "}
            <strong className={textClasses.primary}>{email}</strong>.<br />
            This code is valid for 5 minutes.
          </p>

          <div className="flex justify-center space-x-3 mb-6">
            {code.map((digit, index) => (
              <input
                key={index}
                id={`code-${index}`}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={digit}
                onChange={e => handleCodeChange(index, e.target.value)}
                onKeyDown={e => handleKeyDown(index, e)}
                className={combineClasses(
                  bgClasses.input,
                  borderClasses.primary,
                  "w-12 h-12 text-center text-lg font-semibold rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-500 focus:ring-opacity-20 outline-none transition-colors",
                  textClasses.primary
                )}
                disabled={isLoading}
              />
            ))}
          </div>

          <button
            onClick={handleSubmit}
            disabled={isLoading || code.some(digit => !digit)}
            className={combineClasses(
              buttonClasses.secondary,
              "w-full py-3 rounded-lg font-medium disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center mb-4"
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Verifying...
              </>
            ) : (
              "Verify"
            )}
          </button>

          <div className={combineClasses(textClasses.tertiary, "text-sm")}>
            Didn't receive a code?{" "}
            <button
              onClick={handleResendCode}
              className={combineClasses(
                textClasses.primary,
                "hover:text-gray-300 font-medium underline"
              )}
              disabled={isLoading}
            >
              Resend
            </button>
          </div>
        </div>
      </Modal>

      <FeedbackModal
        isOpen={!!feedback}
        onClose={() => setFeedback(null)}
        type={feedback?.type || "success"}
        title={feedback?.title || ""}
        message={feedback?.message || ""}
      />
    </>
  );
};

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ enabled, onChange }) => {
  return (
    <div
      className={`w-12 h-6 rounded-full p-1 transition-colors cursor-pointer ${enabled ? "bg-purple-600" : "bg-gray-700 dark:bg-gray-700"}`}
      onClick={onChange}
    >
      <div
        className={`bg-white w-4 h-4 rounded-full transform transition-transform ${enabled ? "translate-x-6" : "translate-x-0"}`}
      />
    </div>
  );
};

const SectionCard: React.FC<SectionCardProps> = ({
  children,
  className = "",
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={combineClasses(componentClasses.card, "mb-6 p-6", className)}
    >
      {children}
    </motion.div>
  );
};

const ToggleSection: React.FC<ToggleSectionProps> = ({
  title,
  description,
  enabled,
  onToggle,
  actionButton,
}) => {
  return (
    <SectionCard>
      <div className="flex justify-between items-center">
        <h2
          className={combineClasses(
            textClasses.highlight,
            "text-xl font-medium"
          )}
        >
          {title}
        </h2>
        <ToggleSwitch enabled={enabled} onChange={onToggle} />
      </div>
      <p
        className={combineClasses(textClasses.tertiary, "italic text-sm mt-2")}
      >
        {description}
      </p>
      {actionButton && (
        <div className="flex justify-end mt-4">
          <button
            className={combineClasses(
              buttonClasses.secondary,
              "px-4 py-2 rounded-md"
            )}
            onClick={actionButton.onClick}
          >
            {actionButton.text}
          </button>
        </div>
      )}
    </SectionCard>
  );
};

const Dropdown: React.FC<DropdownProps> = ({
  selected,
  options,
  onSelect,
  label,
  description,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (option: string) => {
    onSelect(option);
    setIsOpen(false);
  };

  return (
    <div className="mb-6">
      <h3 className={combineClasses(textClasses.primary, "text-base mb-3")}>
        {label}
      </h3>

      <div className="relative">
        <button
          className={combineClasses(
            bgClasses.input,
            textClasses.primary,
            "w-full px-4 py-3 rounded-lg flex justify-between items-center"
          )}
          onClick={() => setIsOpen(!isOpen)}
        >
          <span>{selected}</span>
          <ChevronDown size={20} />
        </button>

        {isOpen && (
          <div
            className={combineClasses(
              componentClasses.dropdown,
              "absolute w-full mt-1 z-10"
            )}
          >
            {options.map(option => (
              <button
                key={option}
                className={combineClasses(
                  textClasses.primary,
                  bgClasses.hover,
                  "w-full px-4 py-3 text-left"
                )}
                onClick={() => handleSelect(option)}
              >
                {option}
              </button>
            ))}
          </div>
        )}
      </div>

      <p
        className={combineClasses(textClasses.tertiary, "text-sm mt-2 italic")}
      >
        {description}
      </p>
    </div>
  );
};

const Checkbox: React.FC<CheckboxProps> = ({
  checked,
  onChange,
  label,
  description,
}) => {
  return (
    <div>
      <h3 className={combineClasses(textClasses.primary, "text-base mb-3")}>
        {label}
      </h3>

      <div className="flex items-start gap-3 mb-2">
        <div
          className={`flex items-center justify-center w-5 h-5 rounded border ${checked ? "bg-purple-600 border-purple-400" : `bg-transparent ${borderClasses.primary}`} cursor-pointer mt-1`}
          onClick={onChange}
        >
          {checked && <Check size={16} className="text-white" />}
        </div>
        <span className={textClasses.primary}>{label}</span>
      </div>

      <p className={combineClasses(textClasses.tertiary, "text-sm italic")}>
        {description}
      </p>
    </div>
  );
};

const PrivacySecurityPage: React.FC = () => {
  // State management for all settings
  const [settings, setSettings] = useState({
    twoFactorEnabled: false,
    showActivityStatus: true,
    profileVisibility: "Public (Everyone)",
    emailVerified: false,
  });

  // Modal states
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "warning";
    title: string;
    message: string;
  } | null>(null);

  // Replace the user object with one that gets email from localStorage
  const [userEmail, setUserEmail] = useState("");

  // Add useEffect to get user data from sessionStorage
  useEffect(() => {
    try {
      const userData = sessionStorage.getItem("userData");
      if (userData) {
        const parsedUserData = JSON.parse(userData);
        if (parsedUserData.email) {
          setUserEmail(parsedUserData.email);
        }

        // Check if email is verified
        if (parsedUserData.emailverified) {
          updateSetting("emailVerified", true);
        }
      }
    } catch (error) {
      console.error("Error parsing user data from sessionStorage:", error);
    }
  }, []);

  // Handle all setting changes
  const updateSetting = (
    key: keyof typeof settings,
    value: boolean | string
  ) => {
    setSettings(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const showFeedback = (
    type: "success" | "error" | "warning",
    title: string,
    message: string
  ) => {
    setFeedback({ type, title, message });
  };

  const toggleTwoFactor = () => {
    updateSetting("twoFactorEnabled", !settings.twoFactorEnabled);
  };

  const toggleActivityStatus = () => {
    updateSetting("showActivityStatus", !settings.showActivityStatus);
  };

  const selectVisibilityOption = (option: string) => {
    updateSetting("profileVisibility", option);
  };

  // Manage 2FA button click handler
  const handleManage2FA = () => {
    // TODO: Replace with actual 2FA management flow
    // Example: navigate to 2FA setup or show setup modal

    showFeedback(
      "success",
      "2FA Management",
      "Taking you to two-factor authentication management..."
    );
  };

  const handleChangePassword = () => {
    // TODO: Replace with actual password change flow
    // Example: navigate to change password page or show modal

    showFeedback(
      "success",
      "Redirecting",
      "Taking you to the password change page..."
    );
  };

  // Update the handleVerifyEmail function to use the VerifyEmailCode component
  const handleVerifyEmail = async () => {
    try {
      // Call the API to request email verification
      const response = await fetch("/api/request-email-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: userEmail }),
      });

      if (response.ok) {
        setShowVerifyModal(true);
      } else {
        showFeedback(
          "error",
          "Error",
          "Failed to send verification email. Please try again."
        );
      }
    } catch (error) {
      console.error("Error requesting email verification:", error);
      showFeedback(
        "error",
        "Error",
        "An unexpected error occurred. Please try again."
      );
    }
  };

  const handleEmailVerified = () => {
    updateSetting("emailVerified", true);

    // Update the user data in sessionStorage
    try {
      const userData = sessionStorage.getItem("userData");
      if (userData) {
        const parsedUserData = JSON.parse(userData);
        parsedUserData.emailverified = true;
        sessionStorage.setItem("userData", JSON.stringify(parsedUserData));
      }
    } catch (error) {
      console.error("Error updating user data in sessionStorage:", error);
    }

    showFeedback(
      "success",
      "Email Verified",
      "Your email has been successfully verified!"
    );
  };

  const handleSaveChanges = () => {
    // TODO: Replace with actual API call
    // Example: await updateUserSettings(settings);

    showFeedback(
      "success",
      "Settings Saved",
      "Your privacy and security settings have been updated successfully!"
    );
  };

  const visibilityOptions = [
    "Public (Everyone)",
    "Friends Only",
    "Private (Only Me)",
  ];

  return (
    <div
      className={combineClasses(
        bgClasses.secondary,
        textClasses.primary,
        "min-h-screen"
      )}
    >
      <div className="max-w-8xl mx-auto">
        {/* Email Verification Section */}
        <SectionCard>
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h2
                className={combineClasses(
                  textClasses.highlight,
                  "text-xl font-medium mb-2"
                )}
              >
                Verify Email Address
              </h2>
              <p
                className={combineClasses(
                  textClasses.tertiary,
                  "italic text-sm mb-4"
                )}
              >
                Your account is protected with an additional verification step
                using your Authenticator App. You'll need to provide a
                verification code along with your password when signing in from
                new devices.
              </p>
              <div
                className={combineClasses(
                  bgClasses.input,
                  "flex w-full justify-between px-3 py-4 items-center gap-2 rounded"
                )}
              >
                <span className={textClasses.secondary}>
                  {userEmail || "No email found"}
                </span>
                {settings.emailVerified ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                )}
              </div>
            </div>
          </div>
          <div className="ml-4 justify-end flex gap-4 mt-4">
            {settings.emailVerified ? (
              <button
                disabled
                className="bg-gray-600 text-gray-300 px-4 py-2 rounded-md cursor-not-allowed"
              >
                Email Verified
              </button>
            ) : (
              <button
                onClick={handleVerifyEmail}
                className={combineClasses(
                  buttonClasses.secondary,
                  "px-4 py-2 rounded-md"
                )}
              >
                Verify Email
              </button>
            )}
          </div>
        </SectionCard>

        <ToggleSection
          title="Two-Factor Authentication"
          description="Your account is protected with an additional verification step using your Authenticator App. You'll need to provide a verification code along with your password when signing in from new devices."
          enabled={settings.twoFactorEnabled}
          onToggle={toggleTwoFactor}
          actionButton={{
            text: "Manage 2FA",
            onClick: handleManage2FA,
          }}
        />

        {/* Password */}
        <SectionCard>
          <h2
            className={combineClasses(
              textClasses.highlight,
              "text-xl font-medium mb-2"
            )}
          >
            Password
          </h2>
          <p className={textClasses.tertiary}>
            <button
              className={combineClasses(
                textClasses.highlight,
                "hover:underline italic"
              )}
              onClick={handleChangePassword}
            >
              Change password
            </button>{" "}
            to improve your account security.
          </p>
        </SectionCard>

        <SectionCard>
          <h2
            className={combineClasses(
              textClasses.highlight,
              "text-xl font-medium mb-4"
            )}
          >
            Privacy Controls
          </h2>

          <Dropdown
            label="Profile Visibility"
            description="Choose who can see your profile."
            selected={settings.profileVisibility}
            options={visibilityOptions}
            onSelect={selectVisibilityOption}
          />

          <hr className={combineClasses(borderClasses.primary, "my-4")} />

          <Checkbox
            label="Show Activity Status"
            description="Others can see when you're active on StreamFi."
            checked={settings.showActivityStatus}
            onChange={toggleActivityStatus}
          />
        </SectionCard>

        {/* Save Changes Button */}
        <div className="flex justify-end mb-8">
          <button
            className={combineClasses(
              buttonClasses.secondary,
              "w-full md:w-auto px-6 py-3 rounded-md mb-[4em] lg:mb-0"
            )}
            onClick={handleSaveChanges}
          >
            Save Changes
          </button>
        </div>
      </div>

      {/* Modals */}
      <VerifyEmailModal
        isOpen={showVerifyModal}
        onClose={() => setShowVerifyModal(false)}
        email={userEmail}
        onSuccess={handleEmailVerified}
      />

      <FeedbackModal
        isOpen={!!feedback}
        onClose={() => setFeedback(null)}
        type={feedback?.type || "success"}
        title={feedback?.title || ""}
        message={feedback?.message || ""}
      />
    </div>
  );
};

export default PrivacySecurityPage;
