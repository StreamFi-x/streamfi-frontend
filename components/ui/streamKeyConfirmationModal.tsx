"use client";
import React, { useEffect, useState } from "react";

import { motion, AnimatePresence } from "framer-motion";

interface StreamKeyConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const STREAM_KEY_CONFIRMATION_KEY = "stream_key_confirmation";

const EXPIRATION_TIME = 60 * 60 * 1000;

const StreamKeyConfirmationModal: React.FC<StreamKeyConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [hasConfirmed, setHasConfirmed] = useState(false);

  useEffect(() => {
    const checkConfirmation = () => {
      try {
        const storedData = localStorage.getItem(STREAM_KEY_CONFIRMATION_KEY);

        if (storedData) {
          const { timestamp, sessionId } = JSON.parse(storedData);
          const currentTime = new Date().getTime();

          const isWithinTimeLimit = currentTime - timestamp < EXPIRATION_TIME;

          const currentSessionId = sessionStorage.getItem("browser_session_id");
          const isSameSession = sessionId === currentSessionId;

          setHasConfirmed(isWithinTimeLimit && isSameSession);
        } else {
          setHasConfirmed(false);
        }
      } catch (error) {
        console.error("Error checking stream key confirmation:", error);
        setHasConfirmed(false);
      }
    };
    if (!sessionStorage.getItem("browser_session_id")) {
      sessionStorage.setItem("browser_session_id", `session-${Date.now()}`);
    }

    checkConfirmation();
  }, []);

  const handleConfirmation = () => {
    try {
      // const timestamp = new Date().getTime();
      // const sessionId = sessionStorage.getItem("browser_session_id");

      // localStorage.setItem(
      //   STREAM_KEY_CONFIRMATION_KEY,
      //   JSON.stringify({ timestamp, sessionId })
      // );

      setHasConfirmed(true);
      onConfirm();
      onClose();
    } catch (error) {
      console.error("Error storing stream key confirmation:", error);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="bg-[#1C1C1C] rounded-xl w-full py-10 px-6 max-w-sm  lg:max-w-[450px]  mx-4 text-center shadow-lg"
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center gap-6 mb-4">
              <motion.div
                className="relative"
                initial={{ rotate: -10 }}
                animate={{ rotate: 0 }}
                transition={{ duration: 0.3 }}
              >
                <svg
                  width="50"
                  height="48"
                  viewBox="0 0 50 48"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M20.0749 3.84195C22.2149 -0.0280468 27.7774 -0.0280468 29.9174 3.84195L49.2824 38.8445C51.3574 42.5945 48.6449 47.1945 44.3599 47.1945H5.63493C1.34743 47.1945 -1.36507 42.5945 0.709933 38.8445L20.0749 3.84195ZM27.4924 37.1945C27.503 36.86 27.4463 36.5268 27.3256 36.2147C27.2049 35.9026 27.0227 35.6179 26.7899 35.3776C26.5571 35.1373 26.2783 34.9462 25.9702 34.8157C25.662 34.6852 25.3308 34.6179 24.9962 34.6179C24.6616 34.6179 24.3303 34.6852 24.0222 34.8157C23.7141 34.9462 23.4353 35.1373 23.2025 35.3776C22.9696 35.6179 22.7875 35.9026 22.6668 36.2147C22.5461 36.5268 22.4893 36.86 22.4999 37.1945C22.5205 37.8428 22.7924 38.4578 23.2583 38.9092C23.7242 39.3605 24.3475 39.6129 24.9962 39.6129C25.6449 39.6129 26.2681 39.3605 26.734 38.9092C27.1999 38.4578 27.4719 37.8428 27.4924 37.1945ZM26.8449 17.562C26.7802 17.0911 26.539 16.6624 26.1702 16.3626C25.8014 16.0628 25.3325 15.9143 24.8584 15.947C24.3842 15.9797 23.9402 16.1912 23.6161 16.5388C23.292 16.8864 23.1119 17.3442 23.1124 17.8195L23.1224 29.072L23.1399 29.327C23.2047 29.7978 23.4459 30.2265 23.8147 30.5263C24.1835 30.8261 24.6523 30.9746 25.1265 30.9419C25.6006 30.9092 26.0447 30.6977 26.3688 30.3501C26.6929 30.0025 26.8729 29.5447 26.8724 29.0695L26.8624 17.8145L26.8449 17.562Z"
                    fill="#EBA83A"
                  />
                </svg>
              </motion.div>
            </div>
            <h2 className="text-2xl font-semibold  ">Warning</h2>{" "}
            <div className="flex px-5 mb-2  text-white/60  py-4 text-base flex-col w-full items-center justify-center gap-2">
              <p className="  ">
                You&apos;re about to access sensitive stream information.
              </p>
              <p className="">
                Thisgrants full access to your stream. Do not share this with
                anyone. The StreamFi Team will never ask for it.
              </p>
              <p>
                {" "}
                By clicking &quot;I understand&quot;, you confirm you&apos;re
                copying it intentionally.
              </p>
            </div>
            <motion.button
              onClick={handleConfirmation}
              className="w-full bg-[#5A189A] px-5 hover:bg-purple-900 text-white py-3 rounded-md transition-colors font-medium"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              I understand
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default StreamKeyConfirmationModal;
