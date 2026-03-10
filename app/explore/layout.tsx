"use client";
import type React from "react";
import "../globals.css";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  return (
    <main>
      <div className="flex  flex-col h-screen">
        {/* <Navbar /> */}

        <div className="flex flel flex- h-screen overflow-hidden">
          {/* <Sidebar /> */}

          <main className="flex-1 overflow-y-auto scrollbar-hide">
            {children}
          </main>
        </div>
      </div>
    </main>
  );
}
