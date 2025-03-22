import React from "react";
import SettingsHeader from "./components/header";
import Loader from '@/components/ui/loader/loader'

export default function SettingsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
<Loader>
  <div className="bg-black text-white pt-[2em] px-[1em] lg:px-[2em] min-h-screen">
    <SettingsHeader />
    <div className="mt-8">
      {children}
    </div>
  </div>
</Loader>
  );
}