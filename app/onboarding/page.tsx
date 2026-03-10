"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import ProfileModal from "@/components/explore/ProfileModal";

/**
 * Onboarding page for new Google (Privy) users.
 * Shown after Google login when the user doesn't have a username yet.
 * Reuses the existing ProfileModal in "privy" mode so Privy users go through
 * the same "Complete Your Profile" UX as wallet-connect users.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const { ready, authenticated } = usePrivy();
  const [step, setStep] = useState<"profile" | "verify" | "success">("profile");
  const [privyEmail, setPrivyEmail] = useState<string | undefined>(undefined);

  // Redirect unauthenticated visitors away
  useEffect(() => {
    if (!ready) {return;}
    if (!authenticated) {
      router.replace("/");
    }
  }, [ready, authenticated, router]);

  // Pre-fill email from sessionStorage (set by auth-provider after session creation)
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("privy_user");
      if (stored) {
        const u = JSON.parse(stored);
        if (u?.email) {setPrivyEmail(u.email);}
        // If username is already set, onboarding is complete — go to dashboard
        if (u?.username) {router.replace("/explore");}
      }
    } catch {
      // ignore parse errors
    }
  }, [router]);

  if (!ready || !authenticated) {
    return null; // avoid flash while redirecting
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <ProfileModal
        isOpen={true}
        currentStep={step}
        onClose={() => router.replace("/")}
        onNextStep={setStep}
        setIsProfileModalOpen={open => { if (!open) {router.replace("/");} }}
        mode="privy"
        privyEmail={privyEmail}
      />
    </div>
  );
}
