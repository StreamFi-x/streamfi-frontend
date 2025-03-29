"use client";
import PrivacySecurityContent from "@/components/settings/privacy-and-security/PrivacyAndSecurity";
import ToastProvider from "@/components/ui/toast-provider";

const PrivacySecuritySettings: React.FC = () => {
  return (
    <ToastProvider>
      <PrivacySecurityContent />
    </ToastProvider>
  );
};

export default PrivacySecuritySettings;
