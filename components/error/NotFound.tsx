"use client";

import { type FC, useEffect, useState } from "react";
import {
  motion,
  AnimatePresence,
  Variants,
  Easing,
  useReducedMotion,
} from "framer-motion";
import Link from "next/link";
import { Home, Compass, Play, Users, Monitor, Camera } from "lucide-react";

interface NotFoundProps {
  onGoBack?: () => void;
}

const NotFound: FC<NotFoundProps> = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [currentIcon, setCurrentIcon] = useState(0);
  const shouldReduceMotion = useReducedMotion();

  const streamingIcons = [Play, Users, Monitor, Camera];

  // Define easing functions properly
  const easeOut: Easing = "easeOut";
  const easeInOut: Easing = "easeInOut";

  useEffect(() => {
    setIsVisible(true);
    if (shouldReduceMotion) {
      return;
    }
    const iconInterval = setInterval(() => {
      setCurrentIcon(prev => (prev + 1) % streamingIcons.length);
    }, 2000);

    return () => clearInterval(iconInterval);
  }, [shouldReduceMotion, streamingIcons.length]);

  const containerVariants: Variants = {
    hidden: { opacity: shouldReduceMotion ? 1 : 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.6,
        staggerChildren: shouldReduceMotion ? 0 : 0.2,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: shouldReduceMotion ? 1 : 0, y: shouldReduceMotion ? 0 : 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.6,
        ease: easeOut,
      },
    },
  };

  const floatingVariants: Variants = {
    animate: {
      y: shouldReduceMotion ? 0 : [-10, 10, -10],
      transition: shouldReduceMotion
        ? { duration: 0 }
        : {
            duration: 3,
            repeat: Number.POSITIVE_INFINITY,
            ease: easeInOut,
          },
    },
  };

  const pulseVariants: Variants = {
    animate: {
      scale: shouldReduceMotion ? 1 : [1, 1.1, 1],
      opacity: shouldReduceMotion ? 0.7 : [0.7, 1, 0.7],
      transition: shouldReduceMotion
        ? { duration: 0 }
        : {
            duration: 2,
            repeat: Number.POSITIVE_INFINITY,
            ease: easeInOut,
          },
    },
  };

  const CurrentIcon = streamingIcons[currentIcon];

  return (
    <div
      className={`min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden`}
    >
      {/* Animated Background Elements */}
      {!shouldReduceMotion && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          {/* Floating circles */}
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full bg-highlight/10"
              style={{
                width: 75 + (i * 20),
                height: 75 + (i * 20),
                left: `${(i * 18 + 10) % 90}%`,
                top: `${(i * 23 + 15) % 85}%`,
              }}
              animate={{
                x: [0, (i % 2 === 0 ? 30 : -30)],
                y: [0, (i % 2 === 0 ? -30 : 30)],
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: 10 + i * 2,
                repeat: Number.POSITIVE_INFINITY,
                repeatType: "reverse",
                ease: easeInOut,
              }}
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {isVisible && (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="relative z-10 text-center max-w-2xl mx-auto"
          >
            {/* Main 404 Display */}
            <motion.div variants={itemVariants} className="relative mb-8">
              {/* Background 404 */}
              <motion.div
                className={`absolute inset-0 flex items-center justify-center text-highlight opacity-10`}
                initial={{ scale: shouldReduceMotion ? 1 : 0.8, opacity: shouldReduceMotion ? 0.1 : 0 }}
                animate={{ scale: 1, opacity: 0.1 }}
                transition={{ duration: shouldReduceMotion ? 0 : 1, delay: shouldReduceMotion ? 0 : 0.3 }}
              >
                <span className="text-[20rem] font-black leading-none">
                  404
                </span>
              </motion.div>

              {/* Foreground Content */}
              <div className="relative z-10 py-16">
                {/* Animated Icon */}
                <motion.div
                  variants={floatingVariants}
                  animate="animate"
                  className="mb-8 flex justify-center"
                >
                  <div className="relative">
                    <motion.div
                      variants={pulseVariants}
                      animate="animate"
                      className="absolute inset-0 bg-highlight/20 rounded-full blur-xl"
                    />
                    <div
                      className={`relative bg-card p-6 rounded-full shadow-2xl border border-border border-2`}
                    >
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={currentIcon}
                          initial={
                            shouldReduceMotion
                              ? { opacity: 1 }
                              : { opacity: 0, rotate: -180, scale: 0.5 }
                          }
                          animate={{ opacity: 1, rotate: 0, scale: 1 }}
                          exit={
                            shouldReduceMotion
                              ? { opacity: 1 }
                              : { opacity: 0, rotate: 180, scale: 0.5 }
                          }
                          transition={{ duration: shouldReduceMotion ? 0 : 0.5 }}
                        >
                          <CurrentIcon className={`w-16 h-16 text-highlight`} />
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>

                {/* 404 Text */}
                <motion.h1
                  variants={itemVariants}
                  className={`text-8xl md:text-9xl font-black text-foreground mb-4 tracking-tight`}
                >
                  404
                </motion.h1>

                {/* Stream Offline Message */}
                <motion.div variants={itemVariants} className="mb-6">
                  <h2
                    className={`text-3xl md:text-4xl font-bold text-foreground mb-2`}
                  >
                    Page Not Found
                  </h2>
                  <p
                    className={`text-lg text-muted-foreground max-w-md mx-auto leading-relaxed`}
                  >
                    Looks like the page you&apos;re looking for doesn&apos;t
                    exist or has been moved. Let&apos;s get you back on track!
                  </p>
                </motion.div>

                {/* Action Buttons */}
                <motion.div
                  variants={itemVariants}
                  className="flex flex-col sm:flex-row gap-4 justify-center items-center"
                >
                  <motion.div
                    whileHover={shouldReduceMotion ? undefined : { scale: 1.05 }}
                    whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
                  >
                    <Link
                      href="/"
                      className={`inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl font-semibold text-lg shadow-lg bg-primary text-primary-foreground border border-border hover:text-primary-foreground border-2 w-64`}
                    >
                      <Home className="w-5 h-5 duration-700" />
                      Go Home
                    </Link>
                  </motion.div>

                  <motion.div
                    whileHover={shouldReduceMotion ? undefined : { scale: 1.05 }}
                    whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
                  >
                    <Link
                      href="/explore"
                      className={`inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl font-semibold text-lg shadow-lg bg-transparent border border-border text-foreground w-64`}
                    >
                      <Compass className="w-5 h-5" />
                      Explore Streams
                    </Link>
                  </motion.div>
                </motion.div>

                {/* Live Streams Indicator */}
                <motion.div
                  variants={itemVariants}
                  className="mt-12 pt-8 border-t border-border"
                >
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <motion.div
                      animate={shouldReduceMotion ? undefined : { scale: [1, 1.2, 1] }}
                      transition={
                        shouldReduceMotion
                          ? undefined
                          : {
                              duration: 1.5,
                              repeat: Number.POSITIVE_INFINITY,
                            }
                      }
                      className="w-3 h-3 bg-red-500 rounded-full"
                    />
                    <span
                      className={`text-sm font-medium text-muted-foreground`}
                    >
                      Live streams are still running
                    </span>
                  </div>
                  <div className="flex items-center justify-center gap-6">
                    {[
                      {
                        icon: Users,
                        label: "1.2k viewers",
                        color: "text-blue-500",
                      },
                      { icon: Play, label: "24 live", color: "text-green-500" },
                      {
                        icon: Monitor,
                        label: "Active now",
                        color: "text-highlight",
                      },
                    ].map((item, index) => (
                      <motion.div
                        key={index}
                        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: shouldReduceMotion ? 0 : 1 + index * 0.1 }}
                        className="flex items-center gap-2"
                      >
                        <item.icon className={`w-4 h-4 ${item.color}`} />
                        <span className={`text-sm text-muted-foreground`}>
                          {item.label}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotFound;
