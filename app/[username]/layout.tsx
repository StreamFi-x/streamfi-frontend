"use client"
import { useState } from "react"
import type React from "react"
import Sidebar from "@/components/explore/Sidebar"
import Navbar from "@/components/explore/Navbar"

// Mock data for sidebar props
const sidebarProps = {
  isOpen: true,
  onClose: () => {},
}

export default function UsernameLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { username: string }
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  return (
    <div className="flex h-screen bg-[#17191A] text-white">
      <Sidebar {...sidebarProps} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar toggleSidebar={toggleSidebar} />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
