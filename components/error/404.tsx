"use client";

import { type FC, useEffect, useState } from "react";
import { motion, AnimatePresence, Variants, Easing } from "framer-motion";
import Link from "next/link";
import { Home, Compass, Gamepad2, Zap, Star, Sparkles } from "lucide-react";

interface GameCentric404Props {
  onGoBack: () => void;
}

const GameCentric404: FC<GameCentric404Props> = ({ onGoBack }) => {
  const [glitchActive, setGlitchActive] = useState(false);
  const [particles, setParticles] = useState<
    Array<{ id: number; x: number; y: number; delay: number }>
  >([]);

  // Define easing functions properly
  const easeOut: Easing = "easeOut";
  const easeInOut: Easing = "easeInOut";

  useEffect(() => {
    // Generate random particles
    const newParticles = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 2,
    }));
    setParticles(newParticles);

    // Random glitch effect
    const glitchInterval = setInterval(
      () => {
        setGlitchActive(true);
        setTimeout(() => setGlitchActive(false), 200);
      },
      3000 + Math.random() * 2000
    );

    return () => clearInterval(glitchInterval);
  }, []);

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.5,
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.6,
        ease: easeOut,
      },
    },
  };

  const glitchVariants: Variants = {
    normal: {
      x: 0,
      textShadow: "0 0 0px transparent",
      filter: "hue-rotate(0deg)",
    },
    glitch: {
      x: [-2, 2, -1, 1, 0],
      textShadow: [
        "2px 0 #ff00ff, -2px 0 #00ffff",
        "-2px 0 #ff00ff, 2px 0 #00ffff",
        "2px 0 #ff00ff, -2px 0 #00ffff",
      ],
      filter: ["hue-rotate(0deg)", "hue-rotate(90deg)", "hue-rotate(0deg)"],
      transition: {
        duration: 0.2,
        times: [0, 0.25, 0.5, 0.75, 1],
      },
    },
  };

  const floatingVariants: Variants = {
    animate: {
      y: [-10, 10, -10],
      rotate: [0, 5, -5, 0],
      transition: {
        duration: 4,
        repeat: Number.POSITIVE_INFINITY,
        ease: easeInOut,
      },
    },
  };

  const pulseVariants: Variants = {
    animate: {
      scale: [1, 1.05, 1],
      opacity: [0.7, 1, 0.7],
      transition: {
        duration: 2,
        repeat: Number.POSITIVE_INFINITY,
        ease: easeInOut,
      },
    },
  };

  return (
    <div
      className={`min-h-screen flex items-center justify-center relative overflow-hidden bg-secondary`}
    >
      {/* Animated Background Particles */}
      <div className="absolute inset-0 overflow-hidden">
        {particles.map(particle => (
          <motion.div
            key={particle.id}
            className="absolute w-1 h-1 bg-purple-500 rounded-full opacity-30"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
            }}
            animate={{
              y: [-20, -100],
              opacity: [0, 1, 0],
              scale: [0, 1, 0],
            }}
            transition={{
              duration: 3,
              repeat: Number.POSITIVE_INFINITY,
              delay: particle.delay,
              ease: easeOut,
            }}
          />
        ))}
      </div>

      {/* Gradient Orbs */}
      <motion.div
        className="absolute top-20 left-20 w-32 h-32 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full blur-xl"
        variants={floatingVariants}
        animate="animate"
      />
      <motion.div
        className="absolute bottom-20 right-20 w-40 h-40 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-full blur-xl"
        variants={floatingVariants}
        animate="animate"
        transition={{ delay: 1 }}
      />

      <AnimatePresence>
        <motion.div
          className="text-center z-10 max-w-2xl mx-auto px-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Gaming Icons */}
          <motion.div
            className="flex justify-center gap-4 mb-8"
            variants={itemVariants}
          >
            <motion.div
              variants={pulseVariants}
              animate="animate"
              className="p-3 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur-sm"
            >
              <Gamepad2 className={`w-8 h-8 text-highlight`} />
            </motion.div>
            <motion.div
              variants={pulseVariants}
              animate="animate"
              transition={{ delay: 0.5 }}
              className="p-3 rounded-full bg-gradient-to-r from-blue-500/20 to-cyan-500/20 backdrop-blur-sm"
            >
              <Zap className={`w-8 h-8 text-highlight`} />
            </motion.div>
            <motion.div
              variants={pulseVariants}
              animate="animate"
              transition={{ delay: 1 }}
              className="p-3 rounded-full bg-gradient-to-r from-green-500/20 to-emerald-500/20 backdrop-blur-sm"
            >
              <Star className={`w-8 h-8 text-highlight`} />
            </motion.div>
          </motion.div>

          {/* Main 404 Title with Glitch Effect */}
          <motion.div className="relative mb-6" variants={itemVariants}>
            <motion.h1
              className={`text-8xl md:text-9xl font-black text-foreground relative z-10`}
              variants={glitchVariants}
              animate={glitchActive ? "glitch" : "normal"}
              style={{
                fontFamily: "monospace",
                textShadow: glitchActive
                  ? "2px 0 #ff00ff, -2px 0 #00ffff"
                  : "none",
              }}
            >
              404
            </motion.h1>

            {/* Glitch overlay */}
            <motion.div
              className="absolute inset-0 text-8xl md:text-9xl font-black text-purple-500 opacity-30"
              animate={
                glitchActive
                  ? {
                      x: [2, -2, 1, -1, 0],
                      opacity: [0.3, 0.7, 0.3],
                    }
                  : {}
              }
              transition={{ duration: 0.2 }}
              style={{ fontFamily: "monospace" }}
            >
              404
            </motion.div>
          </motion.div>

          {/* Game Over Text */}
          <motion.div variants={itemVariants} className="mb-8">
            <motion.h2
              className={`text-3xl md:text-4xl font-bold text-foreground mb-4`}
              animate={{
                opacity: [0.8, 1, 0.8],
              }}
              transition={{
                duration: 2,
                repeat: Number.POSITIVE_INFINITY,
                ease: easeInOut,
              }}
            >
              GAME OVER
            </motion.h2>
            <motion.p
              className={`text-lg text-muted-foreground max-w-md mx-auto leading-relaxed`}
              variants={itemVariants}
            >
              Looks like you&apos;ve wandered into uncharted territory! The page
              you&apos;re looking for has respawned elsewhere.
            </motion.p>
          </motion.div>

          {/* Action Buttons */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8"
          >
            <motion.div
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link
                href="/"
                className={`inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl font-semibold text-lg bg-primary text-primary-foreground shadow-lg hover:shadow-xl transform transition-all duration-200`}
              >
                <Home className="w-5 h-5" />
                Respawn Home
              </Link>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link
                href="/explore"
                className={`inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl font-semibold text-lg bg-transparent border border-border text-foreground shadow-lg hover:shadow-xl transform transition-all duration-200`}
              >
                <Compass className="w-5 h-5" />
                Explore Streams
              </Link>
            </motion.div>
          </motion.div>

          {/* Gaming Stats UI */}
          <motion.div
            variants={itemVariants}
            className={`inline-flex items-center gap-6 px-6 py-3 rounded-full bg-card border border-border backdrop-blur-sm`}
          >
            <div className="flex items-center gap-2">
              <Sparkles className={`w-4 h-4 text-highlight`} />
              <span className={`text-sm font-medium text-muted-foreground`}>
                Error Code: 404
              </span>
            </div>
            <div className={`w-px h-4 bg-tertiary`} />
            <div className="flex items-center gap-2">
              <motion.div
                className="w-2 h-2 bg-red-500 rounded-full"
                animate={{
                  opacity: [1, 0.3, 1],
                }}
                transition={{
                  duration: 1,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: easeInOut,
                }}
              />
              <span className={`text-sm font-medium text-muted-foreground`}>
                Connection Lost
              </span>
            </div>
          </motion.div>

          {/* Retry Button */}
          <motion.div variants={itemVariants} className="mt-8">
            <motion.button
              onClick={onGoBack}
              className={`text-sm text-muted-foreground hover:text-foreground transition-colors duration-200`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              ← Go Back to Previous Level
            </motion.button>
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {/* Corner Decorations */}
      <motion.div
        className="absolute top-4 left-4 w-16 h-16 border-l-2 border-t-2 border-purple-500/30"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1, duration: 0.5 }}
      />
      <motion.div
        className="absolute top-4 right-4 w-16 h-16 border-r-2 border-t-2 border-purple-500/30"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.2, duration: 0.5 }}
      />
      <motion.div
        className="absolute bottom-4 left-4 w-16 h-16 border-l-2 border-b-2 border-purple-500/30"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.4, duration: 0.5 }}
      />
      <motion.div
        className="absolute bottom-4 right-4 w-16 h-16 border-r-2 border-b-2 border-purple-500/30"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.6, duration: 0.5 }}
      />
    </div>
  );
};

export default GameCentric404;
