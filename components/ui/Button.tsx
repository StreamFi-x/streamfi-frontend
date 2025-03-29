"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { twMerge } from "tailwind-merge";
import { Loader2 } from "lucide-react";

interface ButtonProps {
  className?: string;
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  isLink?: boolean;
  disabled?: boolean;
  loading?: boolean;
  type?: "button" | "submit" | "reset";
  variant?: "default" | "outline" | "ghost" | "link" | "destructive";
  size?: "sm" | "md" | "lg";
}

export const Button = ({
  className,
  children,
  onClick,
  href,
  isLink,
  disabled,
  loading = false,
  type = "button",
  variant = "default",
  size = "md",
}: ButtonProps) => {
  // Base button styles
  const baseStyles =
    "font-medium rounded-md text-base transition-all px-[20px] py-[12px] duration-300 flex items-center justify-center";

  const variantStyles = {
    default:
      "bg-primary text-white hover:bg-purple-700 focus:ring-2 py-3 px-5  focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-black",
    outline:
      "bg-transparent border border-purple-600 text-purple-600 hover:bg-purple-600/10 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-black",
    ghost:
      "bg-transparent text-white hover:bg-white/10 focus:ring-2 focus:ring-white/20",
    link: "bg-transparent text-purple-600 hover:underline  h-auto",
    destructive:
      "bg-red-600 text-white hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-black",
  };

  // Size styles
  const sizeStyles = {
    sm: "text-xs px-3 py-1.5",
    md: "text-sm px-4 py-2",
    lg: "text-base px-6 py-3",
  };

  const stateStyles = {
    disabled: "opacity-60 cursor-not-allowed",
    loading: "cursor-wait",
  };

  // Combine all styles
  const buttonClass = twMerge(
    baseStyles,
    variantStyles[variant],
    sizeStyles[size],
    disabled || loading ? stateStyles.disabled : "",
    loading ? stateStyles.loading : "",
    className
  );

  // Button content with loading indicator
  const buttonContent = (
    <>
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </>
  );

  // Return link button if isLink is true and href is provided
  if (isLink && href) {
    return (
      <Link
        href={href}
        className={disabled || loading ? "pointer-events-none" : ""}
      >
        <button
          type={type}
          disabled={disabled || loading}
          className={buttonClass}
          onClick={onClick}
        >
          {buttonContent}
        </button>
      </Link>
    );
  }

  // Return regular button
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={buttonClass}
      onClick={onClick}
    >
      {buttonContent}
    </button>
  );
};

export default Button;
