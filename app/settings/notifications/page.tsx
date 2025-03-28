"use client";
import React from "react";
import { ToastProvider } from "@/components/ui/toast-provider";

import NotificationsContent  from "@/components/settings/notifications/NotificationSettings";

const NotificationsSettings: React.FC = () => {
  return (
    <ToastProvider>
      <NotificationsContent />
    </ToastProvider>
  );
};

export default NotificationsSettings;
