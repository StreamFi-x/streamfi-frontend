"use client";

import React, { useState } from "react";
import { Input } from "./input";
import { cn } from "@/lib/utils";
import { Eye, EyeOff } from "lucide-react";

export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input">
>(({ className, type, ...props }, ref) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div
      className={cn(
        "border border-input disabled:cursor-not-allowed rounded-md flex items-center pr-2 justify-normal gap-2",
        className
      )}
    >
      <Input
        type={showPassword ? "text" : "password"}
        className="border-0 focus-within:outline-none outline-none focus:outline-none focus-visible:ring-0"
      />
      {showPassword ? (
        <EyeOff
          onClick={() => setShowPassword(showPassword => !showPassword)}
        />
      ) : (
        <Eye onClick={() => setShowPassword(showPassword => !showPassword)} />
      )}
    </div>
  );
});
