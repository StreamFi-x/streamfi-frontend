"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const router = useRouter();

  useEffect(() => {
    // Simply redirect to profile settings
    router.replace("/settings/profile");
  }, [router]);

  return null;
}
