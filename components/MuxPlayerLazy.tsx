"use client";

/**
 * Lazy-loaded MuxPlayer wrapper using next/dynamic.
 *
 * @mux/mux-player-react bundles Lit web components which add ~100s to the
 * first Turbopack compile when imported statically. Importing from this file
 * instead defers the Mux/Lit bundle until a player is actually rendered,
 * keeping all other pages fast.
 */
import dynamic from "next/dynamic";

const MuxPlayerLazy = dynamic(() => import("@mux/mux-player-react"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-black flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
    </div>
  ),
});

export default MuxPlayerLazy;
