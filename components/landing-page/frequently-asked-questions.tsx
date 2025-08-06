"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus } from "lucide-react";
import { useState } from "react";
import { frequentlyAskedQuestions } from "@/data/landing-page/frequently-asked-questions";
import Section from "@/components/layout/section";

export default function FrequentlyAskedQuestions() {
  const [activeTab, setActiveTab] = useState<number | string | null>(null);

  const toggleTab = (id: number | string) => {
    setActiveTab(activeTab === id ? null : id);
  };

  return (
    <Section
      id="frequently-asked-questions"
      className="flex flex-col items-center gap-6 md:gap-10"
    >
      <motion.div
        className="text-center space-y-2.5"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="font-pp-neue font-extrabold text-2xl sm:text-4xl xl:text-5xl text-white">
          FAQs
        </h1>
        <p className="text-white/80 text-sm sm:text-base max-w-lg mx-auto">
          Find everything you need to know about StreamFi, from getting started
          to maximizing your earnings.
        </p>
      </motion.div>

      <motion.div
        className="w-full space-y-5"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{
          duration: 0.5,
          delay: 0.2,
          staggerChildren: 0.1,
        }}
      >
        {frequentlyAskedQuestions.map((faq) => (
          <motion.div
            key={faq.id}
            className="rounded-xl overflow-hidden shadow-lg border border-gray-700 backdrop-blur-sm"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3 }}
          >
            <button
              onClick={() => toggleTab(faq.id)}
              className="flex items-center justify-between w-full p-4 text-left text-white font-bold text-lg backdrop-blur-sm hover:bg-gray-500/30 transition-all duration-200 ease-in-out"
              aria-expanded={activeTab === faq.id}
              aria-controls={`content-${faq.id}`}
            >
              {faq.title}
              <motion.div
                initial={false}
                animate={{ rotate: activeTab === faq.id ? 180 : 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                {activeTab === faq.id ? (
                  <Minus className="h-5 w-5 text-gray-300" />
                ) : (
                  <Plus className="h-5 w-5 text-gray-300" />
                )}
              </motion.div>
            </button>

            <AnimatePresence initial={false}>
              {activeTab === faq.id && (
                <motion.div
                  id={`content-${faq.id}`}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  className="overflow-hidden min-h-[50px]"
                >
                  <motion.div className="p-4 backdrop-blur text-gray-300 text-sm leading-relaxed">
                    {faq.content}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </motion.div>
    </Section>
  );
}
