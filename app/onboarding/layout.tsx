import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Get Started",
  robots: { index: false, follow: false },
};

export default function OnboardingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
