'use client'
import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Copy from '@/public/Images/copy.png';
import { motion, AnimatePresence } from 'framer-motion';

interface StreamKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}


const STREAM_KEY_CONFIRMATION_KEY = 'stream_key_confirmation';

const EXPIRATION_TIME = 60 * 60 * 1000; 

const StreamKeyModal: React.FC<StreamKeyModalProps> = ({ isOpen, onClose }) => {
  const [hasConfirmed, setHasConfirmed] = useState(false);

  
  useEffect(() => {
    const checkConfirmation = () => {
      try {
        const storedData = localStorage.getItem(STREAM_KEY_CONFIRMATION_KEY);
        
        if (storedData) {
          const { timestamp, sessionId } = JSON.parse(storedData);
          const currentTime = new Date().getTime();
          
          
          const isWithinTimeLimit = currentTime - timestamp < EXPIRATION_TIME;
          
          
          const currentSessionId = sessionStorage.getItem('browser_session_id');
          const isSameSession = sessionId === currentSessionId;
    
          setHasConfirmed(isWithinTimeLimit && isSameSession);
        } else {
          setHasConfirmed(false);
        }
      } catch (error) {
        console.error('Error checking stream key confirmation:', error);
        setHasConfirmed(false);
      }
    };
    if (!sessionStorage.getItem('browser_session_id')) {
      sessionStorage.setItem('browser_session_id', `session-${Date.now()}`);
    }

    checkConfirmation();
  }, []);
  
  
  const handleConfirmation = () => {
    try {
      
      const timestamp = new Date().getTime();
      const sessionId = sessionStorage.getItem('browser_session_id');
      
      localStorage.setItem(
        STREAM_KEY_CONFIRMATION_KEY, 
        JSON.stringify({ timestamp, sessionId })
      );
      
      setHasConfirmed(true);
      onClose();
    } catch (error) {
      console.error('Error storing stream key confirmation:', error);
    }
  };

  
  useEffect(() => {
    if (hasConfirmed && isOpen) {
      onClose();
    }
  }, [hasConfirmed, isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && !hasConfirmed && (
        <motion.div 
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="bg-[#1C1C1C] rounded-lg p-6 max-w-sm w-full mx-4 text-center shadow-lg"
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center mb-4">
              <motion.div 
                className="relative"
                initial={{ rotate: -10 }}
                animate={{ rotate: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Image
                  src={Copy}
                  alt="Copy Icon"
                  width={50}
                  height={50}
                />
              </motion.div>
            </div>
            <h2 className="text-2xl font-semibold text-white mb-4">Stream Key Copied</h2>
            <p className="text-gray-300 mb-6 text-sm">
              Warning: You`ve copied your stream key.
              Keep it secure—anyone with this key can
              stream to your channel!
            </p>
            <motion.button
              onClick={handleConfirmation}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-md transition-colors font-medium"
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

export default StreamKeyModal;