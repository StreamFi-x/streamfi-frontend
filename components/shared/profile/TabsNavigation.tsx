"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowRight } from "lucide-react"

interface TabsNavigationProps {
  username: string
}

const TabsNavigation = ({ username }: TabsNavigationProps) => {
  const pathname = usePathname()

  const tabs = [
    { name: "Home", path: `/${username}` },
    { name: "About", path: `/${username}/about` },
    { name: "Videos", path: `/${username}/videos` },
    { name: "Clips", path: `/${username}/clips` },
    { name: "Watch", path: `/${username}/watch`, icon: <ArrowRight className="h-4 w-4 ml-1" /> },
  ]

  const isActive = (path: string) => {
    if (path === `/${username}` && pathname === `/${username}`) {
      return true
    }
    return pathname.startsWith(path)
  }

  return (
    <div className="border-b border-gray-800">
      <nav className="flex px-6">
        {tabs.map((tab) => (
          <Link
            key={tab.name}
            href={tab.path}
            className={`flex items-center px-4 py-3 text-sm font-medium ${
              isActive(tab.path) ? "text-white border-b-2 border-purple-600" : "text-gray-400 hover:text-white"
            }`}
          >
            {tab.name}
            {tab.icon}
          </Link>
        ))}
      </nav>
    </div>
  )
}

export default TabsNavigation
