"use client"

import { FC } from "react"
import { motion } from "framer-motion"

const LoadingDots: FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 1, duration: 0.8 }}
      className="mt-12"
    >
      <div className="flex flex-wrap justify-center gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ y: 0 }}
            animate={{ y: [0, -10, 0] }}
            transition={{
              duration: 1.5,
              repeat: Number.POSITIVE_INFINITY,
              repeatType: "loop",
              delay: i * 0.1,
            }}
            className="h-2 w-2 rounded-full bg-primary/50"
          />
        ))}
      </div>
    </motion.div>
  )
}

export default LoadingDots