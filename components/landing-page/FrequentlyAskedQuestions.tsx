// "use client";

// import { useState } from "react";
// import { motion, AnimatePresence } from "framer-motion";
// import { Plus, Minus } from "lucide-react";

// import { tabs } from "@/data/faqs";

// export default function AnimatedTabs() {
//   const [activeTab, setActiveTab] = useState<string | null>(null);

//   const toggleTab = (tabId: string) => {
//     setActiveTab(activeTab === tabId ? null : tabId);
//   };

//   return (
//     <div className="w-11/12  mx-auto p-4  flex flex-col gap-14 items-center">
//       <div className="space-y-2.5 max-w-3xl">
//         <h1 className="text-5xl font-bold text-center mt-3">FAQs</h1>
//         <p className="text-center text-[20px] text-white/80 mb-10">
//           Lorem ipsum dolor sit amet consectetur. Dictum elementum malesuada sed
//           a. Cursus sem pellentesque porttitor fringilla consectetur
//           egestas
//         </p>
//       </div>

//       <div className="space-y-5 w-full">
//         {tabs.map((tab) => (
//           <div
//             key={tab.id}
//             className="rounded-lg overflow-hidden shadow-sm border border-gray-700"
//           >
//             <button
//               onClick={() => toggleTab(tab.id)}
//               className="flex items-center justify-between w-full p-4 text-left bg-gray-800 hover:bg-gray-700 transition-all duration-200 ease-in-out"
//               aria-expanded={activeTab === tab.id}
//               aria-controls={`content-${tab.id}`}
//             >
//               <div className="text-white">
//                 <span className="font-bold text-white text-[20px]">
//                   {tab.title}
//                 </span>
//               </div>
//               <motion.div
//                 initial={false}
//                 animate={{
//                   rotate: activeTab === tab.id ? 180 : 0,
//                   scale: activeTab === tab.id ? 1.05 : 1,
//                 }}
//                 transition={{
//                   type: "spring",
//                   stiffness: 400,
//                   damping: 25,
//                   duration: 0.15,
//                 }}
//               >
//                 {activeTab === tab.id ? (
//                   <Minus className="h-5 w-5 text-gray-300" />
//                 ) : (
//                   <Plus className="h-5 w-5 text-gray-300" />
//                 )}
//               </motion.div>
//             </button>

//             <AnimatePresence initial={false}>
//               {activeTab === tab.id && (
//                 <motion.div
//                   id={`content-${tab.id}`}
//                   initial={{ height: 0, opacity: 0 }}
//                   animate={{
//                     height: "auto",
//                     opacity: 1,
//                     transition: {
//                       height: {
//                         type: "spring",
//                         stiffness: 500,
//                         damping: 30,
//                         duration: 0.2,
//                       },
//                       opacity: {
//                         duration: 0.15,
//                         ease: "easeIn",
//                       },
//                     },
//                   }}
//                   exit={{
//                     height: 0,
//                     opacity: 0,
//                     transition: {
//                       height: {
//                         type: "spring",
//                         stiffness: 500,
//                         damping: 30,
//                         duration: 0.15,
//                       },
//                       opacity: {
//                         duration: 0.1,
//                         ease: "easeOut",
//                       },
//                     },
//                   }}
//                   className="overflow-hidden"
//                 >
//                   <motion.div
//                     className="p-4 bg-gray-800"
//                     initial={{ opacity: 0, y: -5 }}
//                     animate={{
//                       opacity: 1,
//                       y: 0,
//                       transition: {
//                         duration: 0.15,
//                         ease: "easeOut",
//                       },
//                     }}
//                   >
//                     <p className="text-gray-400 text-[16px]">{tab.content}</p>
//                   </motion.div>
//                 </motion.div>
//               )}
//             </AnimatePresence>
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// }

"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus } from "lucide-react";
import { useState } from "react";
import { frequentlyAskedQuestions } from "@/data/landing-page/frequentlyAskedQuestions";

export default function FrequentlyAskedQuestions() {
  const [activeTab, setActiveTab] = useState(null);

  const toggleTab = (id) => {
    setActiveTab(activeTab === id ? null : id);
  };

  return (
    <div className="w-11/12 mx-auto p-4 md:p-6 lg:p-8 flex flex-col gap-10 items-center max-w-4xl">
      {/* Title Section */}
      <div className="text-center space-y-2.5">
        <h1 className="text-4xl md:text-5xl font-bold text-white">FAQs</h1>
        <p className="text-lg text-white/80 max-w-lg mx-auto">
          Find everything you need to know about StreamFi, from getting started to maximizing your earnings.
        </p>
      </div>

      {/* FAQ Accordion */}
      <div className="space-y-5 w-full">
        {frequentlyAskedQuestions.map((faq) => (
          <div
            key={faq.id}
            className="rounded-xl overflow-hidden shadow-lg border border-gray-700 bg-gray-900/50"
          >
            <button
              onClick={() => toggleTab(faq.id)}
              className="flex items-center justify-between w-full p-4 text-left text-white font-bold text-lg bg-gray-800 hover:bg-gray-700 transition-all duration-200 ease-in-out"
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
                  <motion.div className="p-4 bg-gray-800 text-gray-300 text-sm leading-relaxed">
                    {faq.content}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}
