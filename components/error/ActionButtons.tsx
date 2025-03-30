"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { Home, Compass } from "lucide-react"
import { FC } from 'react'

interface ActionButtonsProps {
  onGoBack: () => void
}

const ActionButtons: FC<ActionButtonsProps> = ({ onGoBack }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.8 }}
    >
      <div className="flex flex-row justify-center gap-4">
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-md text-white bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
          >
            <Home className="h-4 w-4" />
            Go Home
          </Link>
        </motion.div>
        
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Link
            href="/explore"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-input text-white bg-primary px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Compass className="h-4 w-4" />
            Explore
          </Link>
        </motion.div>
      </div>
    </motion.div>
  )
}

export default ActionButtons