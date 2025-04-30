'use client'
import React, { useState } from 'react';
import { Eye } from 'lucide-react';
import StreamKeyModal from '@/components/ui/streamkeyModal';

interface ToggleSwitchProps {
  enabled: boolean;
  onChange: () => void;
}

interface SecretFieldProps {
  label: string;
  value: string;
  isVisible: boolean;
  onToggleVisibility: () => void;
  actions?: React.ReactNode;
}

interface ToggleSectionProps {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}

interface SectionCardProps {
  children: React.ReactNode;
  className?: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ enabled, onChange }) => {
  return (
    <div 
      className={`w-12 h-6 rounded-full p-1 transition-colors cursor-pointer ${enabled ? 'bg-purple-600' : 'bg-gray-700'}`}
      onClick={onChange}
    >
      <div 
        className={`bg-white w-4 h-4 rounded-full transform transition-transform ${enabled ? 'translate-x-6' : 'translate-x-0'}`}
      />
    </div>
  );
};


const SectionCard: React.FC<SectionCardProps> = ({ children, className = '' }) => {
  return (
    <div className={`bg-[#1a1a1a] rounded-lg p-6 mb-6 ${className}`}>
      {children}
    </div>
  );
};


const SecretField: React.FC<SecretFieldProps> = ({ 
  label, 
  value, 
  isVisible, 
  onToggleVisibility,
  actions 
}) => {
  return (
    <div className="mb-8">
      <h2 className="text-xl text-purple-400 font-medium mb-4">{label}</h2>
      <div className="w-full flex flex-col md:flex-row gap-4">
        <div className="relative w-full">
          <input
            type={isVisible ? "text" : "password"}
            value={value}
            readOnly
            className="w-full bg-[#2a2a2a] text-white rounded-lg p-3 pr-12 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button 
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
            onClick={onToggleVisibility}
          >
            <Eye size={20} />
          </button>
        </div>
        {actions}
      </div>
    </div>
  );
};

const ToggleSection: React.FC<ToggleSectionProps> = ({ 
  title, 
  description, 
  enabled, 
  onToggle 
}) => {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl text-purple-400 font-medium">{title}</h2>
        <ToggleSwitch enabled={enabled} onChange={onToggle} />
      </div>
      <p className="text-gray-400 text-sm italic">
        {description}
      </p>
    </div>
  );
};


const StreamPreferencesPage: React.FC = () => {
  const [state, setState] = useState({
    urlVisible: false,
    keyVisible: false,
    disconnectedProtection: false,
    copyrightWarning: true
  });
  
  // State for the modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const updateState = (key: keyof typeof state, value: boolean) => {
    setState(prev => ({
      ...prev,
      [key]: value
    }));
  };
  
  
  const toggleVisibility = (key: 'urlVisible' | 'keyVisible') => {
    updateState(key, !state[key]);
  };
  
  const toggleSetting = (key: 'disconnectedProtection' | 'copyrightWarning') => {
    updateState(key, !state[key]);
  };
  
  
  const copyKey = () => {
    navigator.clipboard.writeText("stream-key-would-be-here");
    setIsModalOpen(true);
  };
  
  const closeModal = () => {
    setIsModalOpen(false);
  };
  
  const resetKey = () => {
    if (window.confirm("Are you sure you want to reset your stream key? This will invalidate your current key.")) {
      alert("Stream key has been reset!");
    }
  };

  const placeholderDescription = 
    "Add up to 5 social media links to showcase your online presence Add up to 5 social media links to showcase your online presence Add up to 5 social media links to showcase your online presence Add up to 5 social media links to showcase your online presence Add up to 5 social media links to showcase your online presence.";

  
  const streamKeyActions = (
    <div className="flex flex-col items-end gap-4 md:flex-row md:justify-start">
      <button
        className="w-40 bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 rounded-lg whitespace-nowrap"
        onClick={copyKey}
      >
        Copy Key
      </button>
      <button
        className="w-40 bg-gray-700 hover:bg-gray-600 text-white px-4 py-3 rounded-lg whitespace-nowrap"
        onClick={resetKey}
      >
        Reset
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white">      
      <div className="max-w-8xl mx-auto px-4 pt-12 pb-16">
        <SectionCard>
          {/* Stream URL */}
          <SecretField
            label="Stream URL"
            value="https://stream.example.com/live/yourusername"
            isVisible={state.urlVisible}
            onToggleVisibility={() => toggleVisibility('urlVisible')}
          />
          
          {/* Stream Key */}
          <SecretField
            label="Stream Key"
            value="stream-key-would-be-here"
            isVisible={state.keyVisible}
            onToggleVisibility={() => toggleVisibility('keyVisible')}
            actions={streamKeyActions}
          />
        </SectionCard>
        
        
        <SectionCard>
          <ToggleSection
            title="Disconnected Protection"
            description={placeholderDescription}
            enabled={state.disconnectedProtection}
            onToggle={() => toggleSetting('disconnectedProtection')}
          />
        </SectionCard>
        
        <hr className="border-gray-800 my-8" />
        
        
        <SectionCard>
          <ToggleSection
            title="Copyright Warning"
            description={placeholderDescription}
            enabled={state.copyrightWarning}
            onToggle={() => toggleSetting('copyrightWarning')}
          />
        </SectionCard>
      </div>
      
      {/* Stream Key Modal */}
      <StreamKeyModal isOpen={isModalOpen} onClose={closeModal} />
    </div>
  );
};

export default StreamPreferencesPage;