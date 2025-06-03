"use client"
import { useState } from "react"
import type React from "react"
import Sidebar from "@/components/explore/Sidebar"
import Navbar from "@/components/explore/Navbar"


export default function UsernameLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  return (
    <div className="flex h-screen bg-[#17191A] text-white">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar toggleSidebar={toggleSidebar} />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
