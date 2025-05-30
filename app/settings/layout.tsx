"use client"
import type React from "react"
import { useState, Suspense } from "react"
import Loader from "@/components/ui/loader/loader"
import SimpleLoader from "@/components/ui/loader/simple-loader"
import Navbar from "@/components/explore/Navbar"
import Sidebar from "@/components/explore/Sidebar"
import SettingsNavigation from "@/components/settings/SettingsNavigation"

export default function SettingsLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen)
  const closeSidebar = () => setSidebarOpen(false)

  return (
    <main>
      <div className="flex flex-col h-screen bg-black">
        <Navbar toggleSidebar={toggleSidebar} />

        <div className="flex justify-start h-screen overflow-hidden">
          <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />

          <div className="bg-black text-white pt-[2em] px-[1em] lg:px-[2em] w-full flex flex-col items-start">
            <div className="flex-none w-full">
              <h1 className="text-4xl font-bold mb-8">Settings</h1>
              <SettingsNavigation />
            </div>

            <Suspense fallback={<SimpleLoader />}>
              <Loader>
                <div className="flex-1 overflow-y-auto mt-8 w-full scrollbar-hide">{children}</div>
              </Loader>
            </Suspense>
          </div>
        </div>
      </div>
    </main>
  )
}
