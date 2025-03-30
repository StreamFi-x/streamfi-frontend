"use client"

import { FC, ReactNode } from "react"
import { motion } from "framer-motion"

interface NotFoundAnimationProps {
  children: ReactNode
}

const NotFoundAnimation: FC<NotFoundAnimationProps> = ({ children }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative"
    >
      {children}
    </motion.div>
  )
}

export default NotFoundAnimation
