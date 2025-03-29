"use client"

import { FC } from "react"
import { motion } from "framer-motion"

const AnimatedTitle: FC = () => {
  return (
    <motion.h1
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.4, duration: 0.8 }}
      className="text-7xl font-bold text-primary sm:text-8xl"
    >
      404
    </motion.h1>
  )
}

export default AnimatedTitle
