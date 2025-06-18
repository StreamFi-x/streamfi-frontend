"use client"

import { useCallback, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { navItems, recommendedUsers } from "@/data/explore/sidebar"
import Image from "next/image"
import { ArrowLeft, ArrowRight } from "lucide-react"
import QuickActions from "./quick-actions"
import { bgClasses, textClasses, borderClasses, buttonClasses } from "@/lib/theme-classes"

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export default function Sidebar() {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => !prev)
  }, [])

  const isRouteActive = (href: string) => {
    if (href === "/" && pathname === "/explore") return true
    return pathname === `/explore${href}` || pathname.startsWith(`/explore${href}/`)
  }

  const sidebarWidth = isCollapsed ? 70 : 260

  // Enhanced animation variants
  const sidebarVariants = {
    expanded: {
      width: 260,
      transition: {
        duration: 0.6,
        ease: [0.23, 1, 0.32, 1],
        type: "tween",
      },
    },
    collapsed: {
      width: 70,
      transition: {
        duration: 0.6,
        ease: [0.23, 1, 0.32, 1],
        type: "tween",
      },
    },
  }

  const contentVariants = {
    expanded: {
      opacity: 1,
      x: 0,
      scale: 1,
      transition: {
        duration: 0.5,
        ease: [0.23, 1, 0.32, 1],
        staggerChildren: 0.02,
        delayChildren: 0.1,
      },
    },
    collapsed: {
      opacity: 0,
      x: -30,
      scale: 0.95,
      transition: {
        duration: 0.3,
        ease: [0.23, 1, 0.32, 1],
        staggerChildren: 0.01,
        staggerDirection: -1,
      },
    },
  }

  const itemVariants = {
    expanded: {
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.4,
        ease: [0.23, 1, 0.32, 1],
        type: "spring",
        stiffness: 300,
        damping: 30,
      },
    },
    collapsed: {
      opacity: 0,
      x: -20,
      y: -5,
      scale: 0.9,
      transition: {
        duration: 0.2,
        ease: [0.23, 1, 0.32, 1],
      },
    },
  }

  const navItemVariants = {
    rest: {
      scale: 1,
      backgroundColor: "transparent",
      transition: {
        duration: 0.2,
        ease: "easeOut",
      },
    },
    hover: {
      scale: 1.02,
      transition: {
        duration: 0.2,
        ease: "easeOut",
      },
    },
    tap: {
      scale: 0.98,
      transition: {
        duration: 0.1,
        ease: "easeOut",
      },
    },
  }

  const avatarVariants = {
    rest: {
      scale: 1,
      rotate: 0,
      transition: {
        duration: 0.2,
        ease: "easeOut",
      },
    },
    hover: {
      scale: 1.1,
      rotate: 2,
      transition: {
        duration: 0.3,
        ease: "easeOut",
      },
    },
  }

  const liveIndicatorVariants = {
    animate: {
      scale: [1, 1.1, 1],
      opacity: [1, 0.8, 1],
      transition: {
        duration: 2,
        repeat: Number.POSITIVE_INFINITY,
        ease: "easeInOut",
      },
    },
  }

  const renderExpandedContent = () => (
    <motion.div variants={contentVariants} initial="collapsed" animate="expanded" exit="collapsed" className="w-full">
      <motion.div variants={itemVariants} className="flex justify-between items-center w-full mb-4 px-[1em]">
        <motion.span
          variants={itemVariants}
          className={`${textClasses.secondary} font-semibold tracking-wider`}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
        >
          MENU
        </motion.span>
        <motion.button
          variants={itemVariants}
          className={`p-2 ${bgClasses.hover} rounded-full ${textClasses.primary} relative overflow-hidden`}
          onClick={toggleCollapsed}
          whileHover={{ scale: 1.1, rotate: 5 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
          <motion.div
            animate={{ rotate: isCollapsed ? 180 : 0 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          >
            <ArrowLeft size={18} />
          </motion.div>
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-full"
            initial={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
          />
        </motion.button>
      </motion.div>

      <motion.nav variants={itemVariants} className="flex flex-col gap-1">
        {navItems.map((item, index) => {
          const isActive = isRouteActive(item.href)
          return (
            <motion.div
              key={item.label}
              variants={itemVariants}
              custom={index}
              whileHover="hover"
              whileTap="tap"
              initial="rest"
              animate="rest"
            >
              <motion.div variants={navItemVariants}>
                <Link
                  href={`/explore${item.href}`}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-300 relative overflow-hidden ${
                    isActive
                      ? `${bgClasses.selected} ${textClasses.primary} shadow-lg border-l-4 border-purple-500`
                      : `${textClasses.secondary} hover:${textClasses.primary} ${bgClasses.hover}`
                  }`}
                >
                  <motion.div
                    animate={isActive ? { scale: [1, 1.2, 1] } : {}}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                  >
                    <item.icon size={20} className={isActive ? textClasses.primary : textClasses.secondary} />
                  </motion.div>
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05, duration: 0.3 }}
                    className="font-medium"
                  >
                    {item.label}
                  </motion.span>
                  {isActive && (
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-transparent"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3 }}
                    />
                  )}
                </Link>
              </motion.div>
            </motion.div>
          )
        })}
      </motion.nav>

      <motion.hr variants={itemVariants} className={`my-4 border-t ${borderClasses.primary}`} />

      <motion.div variants={itemVariants}>
        <motion.h3
          className={`text-xs font-bold ${textClasses.tertiary} uppercase tracking-wider mb-3 px-1`}
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.3 }}
        >
          RECOMMENDED
        </motion.h3>
        <div className="space-y-1">
          {recommendedUsers.map((user, index) => (
            <motion.div
              key={user.name}
              variants={itemVariants}
              custom={index}
              whileHover="hover"
              initial="rest"
              animate="rest"
            >
              <motion.div variants={navItemVariants}>
                <Link href="#" className={`flex items-center gap-3 px-2 py-2 rounded-lg ${bgClasses.hover}`}>
                  <motion.div
                    variants={avatarVariants}
                    className={`relative w-8 h-8 rounded-full ${bgClasses.tertiary} overflow-hidden`}
                  >
                    <Image
                      src={user.avatar || "/placeholder.svg"}
                      alt={user.name}
                      className="w-full h-full object-cover"
                      width={32}
                      height={32}
                    />
                    {user.status.toLowerCase().includes("watching") && (
                      <motion.div
                        variants={liveIndicatorVariants}
                        animate="animate"
                        className="absolute bottom-0 left-0 bg-red-500 text-white text-[8px] px-1 rounded shadow-lg"
                      >
                        LIVE
                      </motion.div>
                    )}
                  </motion.div>
                  <div>
                    <motion.div
                      className={`text-sm ${textClasses.primary} font-medium`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05, duration: 0.3 }}
                    >
                      {user.name}
                    </motion.div>
                    <motion.div
                      className={`text-xs ${textClasses.tertiary}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 + 0.1, duration: 0.3 }}
                    >
                      {user.status}
                    </motion.div>
                  </div>
                </Link>
              </motion.div>
            </motion.div>
          ))}
        </div>
        <motion.button
          variants={itemVariants}
          className={`w-full mt-3 text-sm ${buttonClasses.secondary} rounded-lg py-2.5 text-center font-medium`}
          whileHover={{ scale: 1.02, y: -1 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
          See more
        </motion.button>
      </motion.div>

      <motion.hr variants={itemVariants} className={`my-4 border-t ${borderClasses.primary}`} />

      <motion.div variants={itemVariants}>
        <motion.h3
          className={`text-xs font-bold ${textClasses.tertiary} uppercase tracking-wider mb-3 px-1`}
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.3 }}
        >
          FOLLOWING
        </motion.h3>
        <div className="space-y-1">
          {recommendedUsers.map((user, index) => (
            <motion.div
              key={`following-${user.name}`}
              variants={itemVariants}
              custom={index}
              whileHover="hover"
              initial="rest"
              animate="rest"
            >
              <motion.div variants={navItemVariants}>
                <Link href="#" className={`flex items-center gap-3 px-2 py-2 rounded-lg ${bgClasses.hover}`}>
                  <motion.div
                    variants={avatarVariants}
                    className={`relative w-8 h-8 rounded-full ${bgClasses.tertiary} overflow-hidden`}
                  >
                    <Image
                      src={user.avatar || "/placeholder.svg"}
                      alt={user.name}
                      className="w-full h-full object-cover"
                      width={32}
                      height={32}
                    />
                    {user.name !== "Guraissay" && (
                      <motion.div
                        variants={liveIndicatorVariants}
                        animate="animate"
                        className="absolute bottom-0 left-0 bg-red-500 text-white text-[8px] px-1 rounded shadow-lg"
                      >
                        LIVE
                      </motion.div>
                    )}
                  </motion.div>
                  <div>
                    <motion.div
                      className={`text-sm ${textClasses.primary} font-medium`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05, duration: 0.3 }}
                    >
                      {user.name}
                    </motion.div>
                    <motion.div
                      className={`text-xs ${textClasses.tertiary}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 + 0.1, duration: 0.3 }}
                    >
                      {user.name === "Zyn"
                        ? "100K Followers"
                        : user.name === "monki"
                          ? "3.7K followers"
                          : "520K followers"}
                    </motion.div>
                  </div>
                </Link>
              </motion.div>
            </motion.div>
          ))}
        </div>
        <motion.button
          variants={itemVariants}
          className={`w-full mt-3 text-sm ${buttonClasses.secondary} rounded-lg py-2.5 text-center font-medium`}
          whileHover={{ scale: 1.02, y: -1 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
          See more
        </motion.button>
      </motion.div>
    </motion.div>
  )

  const renderCollapsedContent = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      className="w-full"
    >
      <div className="flex justify-center items-center w-full mb-4">
        <motion.button
          className={`p-2 ${bgClasses.hover} rounded-full ${textClasses.primary} relative overflow-hidden`}
          onClick={toggleCollapsed}
          whileHover={{ scale: 1.1, rotate: -5 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
          <motion.div
            animate={{ rotate: isCollapsed ? 0 : 180 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          >
            <ArrowRight size={18} />
          </motion.div>
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-full"
            initial={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
          />
        </motion.button>
      </div>

      <motion.nav className="flex flex-col gap-3 items-center">
        {navItems.map((item, index) => {
          const isActive = isRouteActive(item.href)
          return (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: index * 0.1, duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              whileHover={{ scale: 1.1, y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link
                href={`/explore${item.href}`}
                className={`flex items-center justify-center p-3 rounded-lg transition-all duration-300 relative ${
                  isActive
                    ? `${bgClasses.selected} ${textClasses.primary} shadow-lg ring-2 ring-purple-500/30`
                    : `${textClasses.secondary} hover:${textClasses.primary} ${bgClasses.hover}`
                }`}
                title={item.label}
              >
                <motion.div
                  animate={isActive ? { scale: [1, 1.3, 1] } : {}}
                  transition={{ duration: 0.6, ease: "easeInOut" }}
                >
                  <item.icon size={20} className={isActive ? textClasses.primary : textClasses.secondary} />
                </motion.div>
                {isActive && (
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-transparent rounded-lg"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                  />
                )}
              </Link>
            </motion.div>
          )
        })}
      </motion.nav>

      <motion.hr
        initial={{ opacity: 0, scaleX: 0 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ delay: 0.5, duration: 0.3 }}
        className={`my-4 border-t ${borderClasses.primary}`}
      />

      <motion.div className="flex flex-col items-center gap-3">
        {recommendedUsers.map((user, index) => (
          <motion.div
            key={user.name}
            initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ delay: 0.6 + index * 0.1, duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            whileHover={{ scale: 1.15, rotate: 5, y: -2 }}
            whileTap={{ scale: 0.95 }}
          >
            <Link href="#" className="relative" title={user.name}>
              <div className={`w-9 h-9 rounded-full ${bgClasses.tertiary} overflow-hidden shadow-lg`}>
                <Image
                  src={user.avatar || "/placeholder.svg"}
                  alt={user.name}
                  className="w-full h-full object-cover"
                  width={36}
                  height={36}
                />
              </div>
              {user.status.toLowerCase().includes("watching") && (
                <motion.div
                  variants={liveIndicatorVariants}
                  animate="animate"
                  className="absolute -bottom-1 -left-1 bg-red-500 text-white text-[8px] px-1 rounded shadow-lg"
                >
                  LIVE
                </motion.div>
              )}
            </Link>
          </motion.div>
        ))}
      </motion.div>

      <motion.hr
        initial={{ opacity: 0, scaleX: 0 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ delay: 0.8, duration: 0.3 }}
        className={`my-4 border-t ${borderClasses.primary}`}
      />

      <motion.div className="flex flex-col items-center gap-3">
        {recommendedUsers.map((user, index) => (
          <motion.div
            key={`following-${user.name}`}
            initial={{ opacity: 0, scale: 0.5, rotate: 10 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ delay: 0.9 + index * 0.1, duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            whileHover={{ scale: 1.15, rotate: -5, y: -2 }}
            whileTap={{ scale: 0.95 }}
          >
            <Link href="#" className="relative" title={user.name}>
              <div className={`w-9 h-9 rounded-full ${bgClasses.tertiary} overflow-hidden shadow-lg`}>
                <Image
                  src={user.avatar || "/placeholder.svg"}
                  alt={user.name}
                  className="w-full h-full object-cover"
                  width={36}
                  height={36}
                />
              </div>
              {user.name !== "Guraissay" && (
                <motion.div
                  variants={liveIndicatorVariants}
                  animate="animate"
                  className="absolute -bottom-1 -left-1 bg-red-500 text-white text-[8px] px-1 rounded shadow-lg"
                >
                  LIVE
                </motion.div>
              )}
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  )

  return (
    <>
      <motion.div
        className={`hidden lg:block ${bgClasses.highlight} flex-shrink-0 relative overflow-hidden border-r ${borderClasses.primary} shadow-lg`}
        variants={sidebarVariants}
        animate={isCollapsed ? "collapsed" : "expanded"}
        style={{ willChange: "width" }}
      >
        <div className="absolute inset-0">
          <div className="p-4 flex flex-col gap-5 h-full overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={isCollapsed ? "collapsed" : "expanded"}
                className="w-full h-full"
                style={{ willChange: "transform, opacity" }}
              >
                {isCollapsed ? renderCollapsedContent() : renderExpandedContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      <QuickActions />
    </>
  )
}

// "use client";

// import { useCallback, useState } from "react";
// import { motion } from "framer-motion";
// import Link from "next/link";
// import { usePathname } from "next/navigation";
// import { navItems, recommendedUsers } from "@/data/explore/sidebar";
// import Image from "next/image";
// import { ArrowLeft, ArrowRight } from "lucide-react";
// import QuickActions from "./quick-actions";
// import {
//   bgClasses,
//   textClasses,
//   borderClasses,
//   buttonClasses,
// } from "@/lib/theme-classes";

// interface SidebarProps {
//   isOpen?: boolean;
//   onClose?: () => void;
// }

// export default function Sidebar() {
//   const pathname = usePathname();
//   const [isCollapsed, setIsCollapsed] = useState(false);

//   const toggleCollapsed = useCallback(() => {
//     setIsCollapsed((prev) => !prev);
//   }, []);

//   const isRouteActive = (href: string) => {
//     if (href === "/" && pathname === "/explore") return true;
//     return (
//       pathname === `/explore${href}` || pathname.startsWith(`/explore${href}/`)
//     );
//   };

//   const sidebarWidth = isCollapsed ? 70 : 260;

//   const contentVariants = {
//     expanded: {
//       opacity: 1,
//       x: 0,
//       scale: 1,
//       transition: {
//         duration: 0.4,
//         ease: [0.25, 0.1, 0.25, 1],
//         staggerChildren: 0.03,
//       },
//     },
//     collapsed: {
//       opacity: 0,
//       x: -20,
//       scale: 0.9,
//       transition: {
//         duration: 0.25,
//         ease: [0.25, 0.1, 0.25, 1],
//       },
//     },
//   };

//   const itemVariants = {
//     expanded: {
//       opacity: 1,
//       x: 0,
//       scale: 1,
//       transition: {
//         duration: 0.3,
//         ease: [0.25, 0.1, 0.25, 1],
//       },
//     },
//     collapsed: {
//       opacity: 0,
//       x: -15,
//       scale: 0.95,
//       transition: {
//         duration: 0.2,
//         ease: [0.25, 0.1, 0.25, 1],
//       },
//     },
//   };

//   const renderExpandedContent = () => (
//     <motion.div
//       variants={contentVariants}
//       initial={false}
//       animate="expanded"
//       exit="collapsed"
//       className="w-full"
//     >
//       <div className="flex justify-between items-center w-full mb-4 px-[1em]">
//         <motion.span variants={itemVariants} className={textClasses.secondary}>
//           MENU
//         </motion.span>
//         <motion.button
//           variants={itemVariants}
//           className={`p-1 ${bgClasses.hover} rounded-full button-spring no-flicker ${textClasses.primary}`}
//           onClick={toggleCollapsed}
//           whileHover={{ scale: 1.05 }}
//           whileTap={{ scale: 0.95 }}
//           transition={{ type: "spring", stiffness: 500, damping: 25 }}
//         >
//           <motion.div
//             animate={{ rotate: isCollapsed ? 180 : 0 }}
//             transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
//             className="icon-rotate"
//           >
//             <ArrowLeft size={20} />
//           </motion.div>
//         </motion.button>
//       </div>
//       <motion.nav variants={itemVariants} className="flex flex-col gap-1">
//         {navItems.map((item, index) => {
//           const isActive = isRouteActive(item.href);
//           return (
//             <motion.div key={item.label} variants={itemVariants} custom={index}>
//               <Link
//                 href={`/explore${item.href}`}
//                 className={`flex items-center gap-3 p-3 rounded-md transition-all duration-200 ${
//                   isActive
//                     ? `${bgClasses.active} ${textClasses.primary} shadow-lg`
//                     : `${textClasses.secondary} hover:${textClasses.primary} ${bgClasses.hover}`
//                 }`}
//               >
//                 <item.icon
//                   size={20}
//                   className={
//                     isActive ? textClasses.primary : textClasses.secondary
//                   }
//                 />
//                 <span>{item.label}</span>
//               </Link>
//             </motion.div>
//           );
//         })}
//       </motion.nav>

//       <motion.hr
//         variants={itemVariants}
//         className={`my-4 border-t ${borderClasses.primary}`}
//       />
//       <motion.div variants={itemVariants}>
//         <h3
//           className={`text-xs font-semibold ${textClasses.tertiary} uppercase tracking-wider mb-3 px-1`}
//         >
//           RECOMMENDED
//         </h3>
//         <div className="space-y-1">
//           {recommendedUsers.map((user, index) => (
//             <motion.div key={user.name} variants={itemVariants} custom={index}>
//               <Link
//                 href="#"
//                 className={`flex items-center gap-3 px-2 py-2 rounded-md ${bgClasses.hover}`}
//               >
//                 <div
//                   className={`relative w-8 h-8 rounded-full ${bgClasses.tertiary} overflow-hidden`}
//                 >
//                   <Image
//                     src={user.avatar || "/placeholder.svg"}
//                     alt={user.name}
//                     className="w-full h-full object-cover"
//                     width={32}
//                     height={32}
//                   />
//                   {user.status.toLowerCase().includes("watching") && (
//                     <div className="absolute bottom-0 left-0 bg-red-500 text-white text-[8px] px-1 rounded">
//                       LIVE
//                     </div>
//                   )}
//                 </div>
//                 <div>
//                   <div className={`text-sm ${textClasses.primary} font-medium`}>
//                     {user.name}
//                   </div>
//                   <div className={`text-xs ${textClasses.tertiary}`}>
//                     {user.status}
//                   </div>
//                 </div>
//               </Link>
//             </motion.div>
//           ))}
//         </div>
//         <motion.button
//           variants={itemVariants}
//           className={`w-full mt-3 text-sm ${buttonClasses.secondary} rounded-md py-2.5 text-center`}
//         >
//           See more
//         </motion.button>
//       </motion.div>

//       <motion.hr
//         variants={itemVariants}
//         className={`my-4 border-t ${borderClasses.primary}`}
//       />
//       <motion.div variants={itemVariants}>
//         <h3
//           className={`text-xs font-semibold ${textClasses.tertiary} uppercase tracking-wider mb-3 px-1`}
//         >
//           FOLLOWING
//         </h3>
//         <div className="space-y-1">
//           {recommendedUsers.map((user, index) => (
//             <motion.div
//               key={`following-${user.name}`}
//               variants={itemVariants}
//               custom={index}
//             >
//               <Link
//                 href="#"
//                 className={`flex items-center gap-3 px-2 py-2 rounded-md ${bgClasses.hover}`}
//               >
//                 <div
//                   className={`relative w-8 h-8 rounded-full ${bgClasses.tertiary} overflow-hidden`}
//                 >
//                   <Image
//                     src={user.avatar || "/placeholder.svg"}
//                     alt={user.name}
//                     className="w-full h-full object-cover"
//                     width={32}
//                     height={32}
//                   />
//                   {user.name !== "Guraissay" && (
//                     <div className="absolute bottom-0 left-0 bg-red-500 text-white text-[8px] px-1 rounded">
//                       LIVE
//                     </div>
//                   )}
//                 </div>
//                 <div>
//                   <div className={`text-sm ${textClasses.primary} font-medium`}>
//                     {user.name}
//                   </div>
//                   <div className={`text-xs ${textClasses.tertiary}`}>
//                     {user.name === "Zyn"
//                       ? "100K Followers"
//                       : user.name === "monki"
//                         ? "3.7K followers"
//                         : "520K followers"}
//                   </div>
//                 </div>
//               </Link>
//             </motion.div>
//           ))}
//         </div>
//         <motion.button
//           variants={itemVariants}
//           className={`w-full mt-3 text-sm ${buttonClasses.secondary} rounded-md py-2.5 text-center`}
//         >
//           See more
//         </motion.button>
//       </motion.div>
//     </motion.div>
//   );

//   const renderCollapsedContent = () => (
//     <motion.div className="w-full">
//       <div className="flex justify-center items-center w-full mb-4">
//         <motion.button
//           className={`p-1 ${bgClasses.hover} rounded-full button-spring no-flicker ${textClasses.primary}`}
//           onClick={toggleCollapsed}
//           whileHover={{ scale: 1.05 }}
//           whileTap={{ scale: 0.95 }}
//           transition={{ type: "spring", stiffness: 500, damping: 25 }}
//         >
//           <motion.div
//             animate={{ rotate: isCollapsed ? 0 : 180 }}
//             transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
//             className="icon-rotate"
//           >
//             <ArrowRight size={20} />
//           </motion.div>
//         </motion.button>
//       </div>
//       <motion.nav
//         variants={itemVariants}
//         className="flex flex-col gap-3 items-center"
//       >
//         {navItems.map((item, index) => {
//           const isActive = isRouteActive(item.href);
//           return (
//             <motion.div key={item.label} variants={itemVariants} custom={index}>
//               <Link
//                 href={`/explore${item.href}`}
//                 className={`flex items-center justify-center p-3 rounded-md transition-all duration-200 ${
//                   isActive
//                     ? `${bgClasses.active} ${textClasses.primary} shadow-lg`
//                     : `${textClasses.secondary} hover:${textClasses.primary} ${bgClasses.hover}`
//                 }`}
//                 title={item.label}
//               >
//                 <item.icon
//                   size={20}
//                   className={
//                     isActive ? textClasses.primary : textClasses.secondary
//                   }
//                 />
//               </Link>
//             </motion.div>
//           );
//         })}
//       </motion.nav>

//       <motion.hr
//         variants={itemVariants}
//         className={`my-4 border-t ${borderClasses.primary}`}
//       />

//       <motion.div
//         variants={itemVariants}
//         className="flex flex-col items-center gap-3"
//       >
//         {recommendedUsers.map((user, index) => (
//           <motion.div key={user.name} variants={itemVariants} custom={index}>
//             <Link
//               href="#"
//               className="relative transition-transform duration-200 hover:scale-110"
//               title={user.name}
//             >
//               <div
//                 className={`w-9 h-9 rounded-full ${bgClasses.tertiary} overflow-hidden`}
//               >
//                 <Image
//                   src={user.avatar || "/placeholder.svg"}
//                   alt={user.name}
//                   className="w-full h-full object-cover"
//                   width={36}
//                   height={36}
//                 />
//               </div>
//               {user.status.toLowerCase().includes("watching") && (
//                 <div className="absolute bottom-0 left-0 bg-red-500 text-white text-[8px] px-1 rounded">
//                   LIVE
//                 </div>
//               )}
//             </Link>
//           </motion.div>
//         ))}
//       </motion.div>

//       <motion.hr
//         variants={itemVariants}
//         className={`my-4 border-t ${borderClasses.primary}`}
//       />
//       <motion.div
//         variants={itemVariants}
//         className="flex flex-col items-center gap-3"
//       >
//         {recommendedUsers.map((user, index) => (
//           <motion.div
//             key={`following-${user.name}`}
//             variants={itemVariants}
//             custom={index}
//           >
//             <Link
//               href="#"
//               className="relative transition-transform duration-200 hover:scale-110"
//               title={user.name}
//             >
//               <div
//                 className={`w-9 h-9 rounded-full ${bgClasses.tertiary} overflow-hidden`}
//               >
//                 <Image
//                   src={user.avatar || "/placeholder.svg"}
//                   alt={user.name}
//                   className="w-full h-full object-cover"
//                   width={36}
//                   height={36}
//                 />
//               </div>
//               {user.name !== "Guraissay" && (
//                 <div className="absolute bottom-0 left-0 bg-red-500 text-white text-[8px] px-1 rounded">
//                   LIVE
//                 </div>
//               )}
//             </Link>
//           </motion.div>
//         ))}
//       </motion.div>
//     </motion.div>
//   );

//   return (
//     <>
//       <motion.div
//         className={`hidden lg:block ${bgClasses.sidebar} flex-shrink-0 relative overflow-hidden sidebar-container sidebar-animated border-r ${borderClasses.primary}`}
//         animate={{ width: sidebarWidth }}
//         transition={{
//           duration: 0.5,
//           ease: [0.25, 0.1, 0.25, 1],
//           type: "tween",
//         }}
//       >
//         <div className="absolute inset-0 fixed-content-width layout-stable">
//           <div className="p-4 flex flex-col gap-5 h-full overflow-hidden smooth-fonts">
//             <motion.div
//               key={isCollapsed ? "collapsed" : "expanded"}
//               variants={contentVariants}
//               initial={false}
//               animate="expanded"
//               exit="collapsed"
//               className="w-full h-full gpu-accelerated"
//             >
//               {isCollapsed ? renderCollapsedContent() : renderExpandedContent()}
//             </motion.div>
//           </div>
//         </div>
//       </motion.div>

//       {/* Quick Actions */}
//       <QuickActions />
//     </>
//   );
// }
