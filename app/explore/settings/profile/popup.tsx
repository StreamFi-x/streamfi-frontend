import React, { useState, useRef, useEffect } from 'react';

interface VerificationPopupProps {
  email: string;
  onClose: () => void;
  onVerify: (code: string) => void;
}

const VerificationPopup: React.FC<VerificationPopupProps> = ({ email, onClose, onVerify }) => {
  const [verificationCode, setVerificationCode] = useState<string[]>(Array(6).fill(''));
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handleInputChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newCode = [...verificationCode];
    newCode[index] = value;
    setVerificationCode(newCode);
    
    if (value && index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !verificationCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleFocus = (index: number) => {
    setFocusedIndex(index);
  };

  const handleBlur = () => {
    setFocusedIndex(null);
  };

  const handleVerify = () => {
    const code = verificationCode.join('');
    if (code.length === 6) {
      onVerify(code);
      onClose();
    }
  };

  const handleResend = () => {
    console.log('Resending code to', email);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[#1a1a1a] rounded-lg p-8 max-w-md w-full mx-4 relative">
        <h2 className="text-white text-2xl font-bold text-center mb-4">Enter Verification code</h2>
        
        <p className="text-gray-400 text-center mb-2">
          Enter the 6-digit code sent to
        </p>
        <p className="text-white text-center font-medium mb-6">
          {email}. <span className="text-gray-400">This code is valid for 5 minutes.</span>
        </p>
        
        <div className="flex justify-center gap-2 mb-8">
          {verificationCode.map((digit, index) => (
            <input
              key={index}
              type="text"
              maxLength={1}
              value={digit}
              ref={(el) => { inputRefs.current[index] = el; }}
              onChange={e => handleInputChange(index, e.target.value)}
              onKeyDown={e => handleKeyDown(index, e)}
              onFocus={() => handleFocus(index)}
              onBlur={handleBlur}
              className={`
                w-12 h-12 
                bg-[#2a2a2a] 
                text-white 
                text-center 
                text-xl 
                rounded-md 
                outline-none 
                transition-all
                duration-150
                ${focusedIndex === index ? 'border-2 border-[#5A189A]' : ''}
              `}
              style={{
                boxShadow: focusedIndex === index ? '0 0 0 2px rgba(90, 24, 154, 0.3)' : 'none'
              }}
            />
          ))}
        </div>
        
        <button
          onClick={handleVerify}
          className="w-full bg-[#5A189A] hover:bg-opacity-90 text-white py-3 rounded-md transition mb-4"
        >
          Verify
        </button>
        
        <div className="text-center">
          <span className="text-gray-400">Didn&apos;t receive a code?</span>{' '}
          <button
            onClick={handleResend}
            className="text-white underline"
          >
            Resend
          </button>
        </div>
      </div>
    </div>
  );
};

export default VerificationPopup;