"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Plus, Minus } from "lucide-react"

interface TabItem {
  id: string
  title: string
  content: string
}

export default function AnimatedTabs() {
  const [activeTab, setActiveTab] = useState<string | null>(null)

  const tabs: TabItem[] = [
    {
      id: "tab1",
      title: "What is StreamFi?",
      content:
        "StreamFi is a decentralized live-streaming platform that allows creators to monetize their content without intermediaries. Powered by blockchain technology, it ensures 100% earnings retention, direct fan engagement, and community-driven governance.",
    },
    {
      id: "tab2",
      title: "How do creators earn on StreamFi?",
      content:
        "StreamFi is a decentralized live-streaming platform that allows creators to monetize their content without intermediaries. Powered by blockchain technology, it ensures 100% earnings retention, direct fan engagement, and community-driven governance.",
    },
    {
      id: "tab3",
      title: "Do I need crypto knowledge to use StreamFi?",
      content:
      "StreamFi is a decentralized live-streaming platform that allows creators to monetize their content without intermediaries. Powered by blockchain technology, it ensures 100% earnings retention, direct fan engagement, and community-driven governance.",
    },
    {
      id: "tab4",
      title: " Is StreamFi free to use?",
      content:
      "StreamFi is a decentralized live-streaming platform that allows creators to monetize their content without intermediaries. Powered by blockchain technology, it ensures 100% earnings retention, direct fan engagement, and community-driven governance.",
    },
  ]

  const toggleTab = (tabId: string) => {
    setActiveTab(activeTab === tabId ? null : tabId)
  }

  return (
    <div className="w-11/12  mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold text-center mb-6 mt-3">FAQs</h1>
      <p className="text-center mt-3 text-sm">Lorem ipsum dolor sit amet consectetur. Dictum elementum malesuada sed a. Cursus sem pellentesque <br/> porttitor fringilla consectetur egestas</p>

      <div className="space-y-3">
        {tabs.map((tab) => (
          <div key={tab.id} className="rounded-lg overflow-hidden shadow-sm">
            <button
              onClick={() => toggleTab(tab.id)}
              className="flex items-center justify-between w-full p-4 text-left bg-gray-700 hover:bg-gray-700 transition-all duration-300 ease-in-out"
              aria-expanded={activeTab === tab.id}
              aria-controls={`content-${tab.id}`}
            >
                <div className="text-white">
              <span className="font-bold text-white">{tab.title}</span>
              </div>
              <motion.div
                initial={false}
                animate={{
                  rotate: activeTab === tab.id ? 180 : 0,
                  scale: activeTab === tab.id ? 1.1 : 1,
                }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 20,
                }}
              >
                {activeTab === tab.id ? (
                  <Minus className="h-5 w-5 text-gray-300" />
                ) : (
                  <Plus className="h-5 w-5 text-gray-300" />
                )}
              </motion.div>
            </button>

            <AnimatePresence initial={false}>
              {activeTab === tab.id && (
                <motion.div
                  id={`content-${tab.id}`}
                  initial={{ height: 0, opacity: 0, y: -10 }}
                  animate={{
                    height: "auto",
                    opacity: 1,
                    y: 0,
                    transition: {
                      height: {
                        type: "spring",
                        stiffness: 400,
                        damping: 30,
                        mass: 1,
                        duration: 0.4,
                      },
                      opacity: {
                        duration: 0.4,
                        ease: [0.4, 0, 0.2, 1],
                      },
                      y: {
                        type: "spring",
                        stiffness: 500,
                        damping: 25,
                      },
                    },
                  }}
                  exit={{
                    height: 0,
                    opacity: 0,
                    y: -10,
                    transition: {
                      height: {
                        type: "spring",
                        stiffness: 400,
                        damping: 35,
                        mass: 0.8,
                        duration: 0.3,
                      },
                      opacity: {
                        duration: 0.25,
                        ease: [0.4, 0, 1, 1],
                      },
                      y: {
                        duration: 0.15,
                      },
                    },
                  }}
                  className="overflow-hidden"
                >
                  <motion.div
                    className="p-4 bg-gray-700"
                    // initial={{ opacity: 0, y: 10 }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      transition: {
                        delay: 0.1,
                        duration: 0.3,
                        ease: "easeOut",
                      },
                    }}
                  >
                    <p className="text-gray-300">{tab.content}</p>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  )
}

