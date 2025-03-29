"use client"

import { FC } from "react"
import { motion } from "framer-motion"

const BackgroundNumber: FC = () => {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 0.05 }}
      transition={{ delay: 0.2, duration: 0.8 }}
      className="absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 text-[20rem] font-bold text-primary"
    >
      404
    </motion.div>
  )
}

export default BackgroundNumber
