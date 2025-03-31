// import { useState, useRef, useEffect } from "react";
// import { StreamfiLogo } from "@/public/icons";
// import { Menu, Search, X } from "lucide-react";
// import Image from "next/image";
// import { motion, AnimatePresence } from "framer-motion";
// import { NavbarProps, SearchResult } from "@/types/explore";

// export default function Navbar({ toggleSidebar, onConnect }: NavbarProps) {
//   const [searchOpen, setSearchOpen] = useState(false);
//   const [searchQuery, setSearchQuery] = useState("");
//   const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
//   const searchInputRef = useRef<HTMLInputElement>(null);

//   useEffect(() => {
//     if (searchQuery.trim() === "") {
//       setSearchResults([]);
//       return;
//     }

//     const mockResults: SearchResult[] = [
//       {
//         id: "1",
//         title: `${searchQuery} Live Stream`,
//         type: "stream",
//         image: "/icons/Recommend pfps.svg",
//       },
//       {
//         id: "2",
//         title: `${searchQuery} Gaming Channel`,
//         type: "channel",
//         image: "/icons/Recommend pfps.svg",
//       },
//       {
//         id: "3",
//         title: `Best ${searchQuery} Moments`,
//         type: "video",
//         image: "/icons/Recommend pfps.svg",
//       },
//     ];

//     setSearchResults(mockResults);
//   }, [searchQuery]);

//   useEffect(() => {
//     if (searchOpen && searchInputRef.current) {
//       searchInputRef.current.focus();
//     }
//   }, [searchOpen]);

//   const handleOpenSearch = () => {
//     setSearchOpen(true);
//   };

//   const handleCloseSearch = () => {
//     setSearchOpen(false);
//     setSearchQuery("");
//   };

//   return (
//     <header className="h-16 flex items-center justify-between px-4 border-b-[0.5px] border-white/30 bg-background z-10">
//       <div className="flex items-center gap-4">
//         <button
//           onClick={toggleSidebar}
//           className="p-2 rounded-full hover:bg-[#2D2F31]/60 lg:hidden"
//         >
//           <Menu size={24} />
//         </button>
//         <Image src={StreamfiLogo || "/placeholder.svg"} alt="Streamfi Logo" />
//       </div>

//       <div className="hidden md:block flex-1 items-center  max-w-xl mx-4 relative">
//         <div className="relative">
//           <input
//             type="text"
//             placeholder="Search"
//             value={searchQuery}
//             onChange={(e) => setSearchQuery(e.target.value)}
//             className="w-full bg-black rounded-md py-2 pl-10 pr-4 text-sm outline-none duration-200 focus:outline-none focus:ring-1 focus:ring-purple-600"
//           />
//           <Search
//             className="absolute left-3 top-[47%] transform -translate-y-1/2 text-gray-400"
//             size={16}
//           />
//         </div>

//         <AnimatePresence>
//           {searchResults.length > 0 && (
//             <motion.div
//               initial={{ opacity: 0, y: -10 }}
//               animate={{ opacity: 1, y: 0 }}
//               exit={{ opacity: 0, y: -10 }}
//               className="absolute top-full left-0 right-0 mt-2 bg-[#1A1B1D] rounded-md shadow-lg overflow-hidden z-20"
//             >
//               <div className="p-2">
//                 {searchResults.map((result) => (
//                   <div
//                     key={result.id}
//                     className="flex items-center gap-3 p-2 hover:bg-[#2D2F31] rounded-md cursor-pointer"
//                   >
//                     <div className="w-10 h-10 rounded bg-gray-700 overflow-hidden">
//                       <img
//                         src={result.image || "/placeholder.svg"}
//                         alt={result.title}
//                         className="w-full h-full object-cover"
//                       />
//                     </div>
//                     <div>
//                       <div className="text-sm font-medium">{result.title}</div>
//                       <div className="text-xs text-white/30 capitalize">
//                         {result.type}
//                       </div>
//                     </div>
//                   </div>
//                 ))}
//               </div>
//             </motion.div>
//           )}
//         </AnimatePresence>
//       </div>

//       <div className="md:hidden">
//         <button
//           onClick={handleOpenSearch}
//           className="p-2 rounded-full hover:bg-[#2D2F31]/60"
//         >
//           <Search size={20} />
//         </button>
//       </div>

//       <AnimatePresence>
//         {searchOpen && (
//           <motion.div
//             initial={{ opacity: 0 }}
//             animate={{ opacity: 1 }}
//             exit={{ opacity: 0 }}
//             className="fixed inset-0 bg-black/90 z-50 flex flex-col p-4"
//           >
//             <div className="flex items-center gap-3 mb-4">
//               <button
//                 onClick={handleCloseSearch}
//                 className="p-2 rounded-full hover:bg-[#2D2F31]/60"
//               >
//                 <X size={20} />
//               </button>
//               <div className="flex-1 relative">
//                 <input
//                   ref={searchInputRef}
//                   type="text"
//                   placeholder="Search"
//                   value={searchQuery}
//                   onChange={(e) => setSearchQuery(e.target.value)}
//                   className="w-full bg-[#1A1B1D] rounded-md py-2 px-4 text-sm outline-none"
//                 />
//               </div>
//             </div>

//             <div className="flex-1 overflow-y-auto">
//               {searchResults.length > 0 ? (
//                 <div className="space-y-2">
//                   {searchResults.map((result) => (
//                     <div
//                       key={result.id}
//                       className="flex items-center gap-3 p-3 hover:bg-[#2D2F31] rounded-md cursor-pointer"
//                     >
//                       <div className="w-12 h-12 rounded bg-gray-700 overflow-hidden">
//                         <Image
//                           src={result.image || "/placeholder.svg"}
//                           alt={result.title}
//                           className="w-full h-full object-cover"
//                           width={20}
//                           height={20}
//                         />
//                       </div>
//                       <div>
//                         <div className="text-sm font-medium">
//                           {result.title}
//                         </div>
//                         <div className="text-xs text-white/30 capitalize">
//                           {result.type}
//                         </div>
//                       </div>
//                     </div>
//                   ))}
//                 </div>
//               ) : searchQuery ? (
//                 <div className="text-center py-8 text-white/50">
//                   No results found for &quot;{searchQuery}&quot;
//                 </div>
//               ) : (
//                 <div className="text-center py-8 text-white/50">
//                   Type to search
//                 </div>
//               )}
//             </div>
//           </motion.div>
//         )}
//       </AnimatePresence>

//       <button
//         onClick={onConnect}
//         className="bg-primary lg:hidden hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
//       >
//         Connect
//       </button>
//       <button
//         onClick={onConnect}
//         className="bg-primary hidden lg:flex hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
//       >
//         Connect wallet
//       </button>
//     </header>
//   );git push --set-upstream origin connect-modal
// }

"use client";
import { useState, useRef, useEffect } from "react";
import { StreamfiLogo, StreamfiLogoShort } from "@/public/icons";
import { Menu, Search, X } from "lucide-react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { SearchResult } from "@/types/explore";
import { useAccount, useDisconnect } from "@starknet-react/core";
import ConnectModal from "../connectWallet";

interface NavbarProps {
  onConnectWallet?: () => void;
  toggleSidebar?: () => void;
  onConnect?: () => void;
}

export default function Navbar({
  toggleSidebar,
  onConnectWallet,
}: NavbarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setSearchResults([]);
      return;
    }

    const mockResults: SearchResult[] = [
      {
        id: "1",
        title: `${searchQuery} Live Stream`,
        type: "stream",
        image: "/icons/Recommend pfps.svg",
      },
      {
        id: "2",
        title: `${searchQuery} Gaming Channel`,
        type: "channel",
        image: "/icons/Recommend pfps.svg",
      },
      {
        id: "3",
        title: `Best ${searchQuery} Moments`,
        type: "video",
        image: "/icons/Recommend pfps.svg",
      },
    ];

    setSearchResults(mockResults);
  }, [searchQuery]);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  const handleConnectWallet = () => {
    if (isConnected) {
      disconnect(); // Disconnect if already connected
    } else {
      setIsModalOpen(true); // Open modal to connect
    }
  };

  // Close modal automatically when wallet is connected
  useEffect(() => {
    if (isConnected) {
      setIsModalOpen(false);
    }
  }, [isConnected]);

  return (
    <>
      <header className="h-16 flex items-center justify-between px-4 border-b-[0.5px] border-white/30 bg-background z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-full text-white hover:bg-[#2D2F31]/60 lg:hidden"
          >
            <Menu size={24} />
          </button>
          <Image
            src={StreamfiLogoShort || "/placeholder.svg"}
            alt="Streamfi Logo"
          />
        </div>

        <div className="hidden md:block flex-1 items-center max-w-xl mx-4 relative">
          <div className="relative">
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black rounded-md py-2 pl-10 pr-4 text-sm outline-none duration-200 focus:outline-none focus:ring-1 focus:ring-purple-600"
            />
            <Search
              className="absolute left-3 top-[47%] transform -translate-y-1/2 text-gray-400"
              size={16}
            />
          </div>
          <AnimatePresence>
            {searchResults.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full left-0 right-0 mt-2 bg-[#1A1B1D] rounded-md shadow-lg overflow-hidden z-20"
              >
                <div className="p-2">
                  {searchResults.map((result) => (
                    <div
                      key={result.id}
                      className="flex items-center gap-3 p-2 hover:bg-[#2D2F31] rounded-md cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded bg-gray-700 overflow-hidden">
                        <img
                          src={result.image || "/placeholder.svg"}
                          alt={result.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <div className="text-sm font-medium">
                          {result.title}
                        </div>
                        <div className="text-xs text-white/30 capitalize">
                          {result.type}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-4">
          {isConnected && address && (
            <span className="text-white text-sm truncate max-w-[150px]">
              {address.substring(0, 6)}...{address.slice(-4)}
            </span>
          )}

          <button
            onClick={handleConnectWallet}
            className="bg-primary hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
          >
            {isConnected ? "Disconnect" : "Connect Wallet"}
          </button>
        </div>
      </header>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black opacity-50"
              onClick={() => setIsModalOpen(false)}
            />
            {/* Modal Content */}
            <motion.div className="bg-background p-6 rounded-md z-10">
              <ConnectModal
                isModalOpen={isModalOpen}
                setIsModalOpen={setIsModalOpen}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
