"use client";
import React from "react";
import ProfileSettings from "../../../components/settings/profile/profile-page";
import { ToastProvider } from "@/components/ui/toast-provider";

const page = () => {
  return (
    <ToastProvider>
      <ProfileSettings />
    </ToastProvider>
  );
};

export default page;
