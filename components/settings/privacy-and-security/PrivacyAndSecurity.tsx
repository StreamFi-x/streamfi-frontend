import React, { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';


interface ToggleSwitchProps {
  enabled: boolean;
  onChange: () => void;
}

interface SectionCardProps {
  children: React.ReactNode;
  className?: string;
}

interface ToggleSectionProps {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  actionButton?: {
    text: string;
    onClick: () => void;
  };
}

interface DropdownProps {
  selected: string;
  options: string[];
  onSelect: (option: string) => void;
  label: string;
  description: string;
}

interface CheckboxProps {
  checked: boolean;
  onChange: () => void;
  label: string;
  description: string;
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
    <div className={`mb-6 bg-[#1a1a1a] rounded-lg p-6 ${className}`}>
      {children}
    </div>
  );
};


const ToggleSection: React.FC<ToggleSectionProps> = ({ 
  title, 
  description, 
  enabled, 
  onToggle, 
  actionButton 
}) => {
  return (
    <SectionCard>
      <div className="flex justify-between items-center">
        <h2 className="text-xl text-purple-400 font-medium">{title}</h2>
        <ToggleSwitch enabled={enabled} onChange={onToggle} />
      </div>
      <p className="italic text-gray-400 text-sm mt-2">
        {description}
      </p>
      {actionButton && (
        <div className="flex justify-end mt-4">
          <button 
            className="bg-[#5A189A] hover:bg-opacity-90 text-white px-4 py-2 rounded-md transition"
            onClick={actionButton.onClick}
          >
            {actionButton.text}
          </button>
        </div>
      )}
    </SectionCard>
  );
};


const Dropdown: React.FC<DropdownProps> = ({ 
  selected, 
  options, 
  onSelect, 
  label, 
  description 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const handleSelect = (option: string) => {
    onSelect(option);
    setIsOpen(false);
  };
  
  return (
    <div className="mb-6">
      <h3 className="text-white text-base mb-3">{label}</h3>
      
      <div className="relative">
        <button 
          className="w-full px-4 py-3 bg-[#222] rounded-lg flex justify-between items-center"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span>{selected}</span>
          <ChevronDown size={20} />
        </button>
        
        {isOpen && (
          <div className="absolute w-full mt-1 bg-[#222] rounded-lg shadow-lg z-10">
            {options.map((option) => (
              <button
                key={option}
                className="w-full px-4 py-3 text-left hover:bg-[#333] transition-colors"
                onClick={() => handleSelect(option)}
              >
                {option}
              </button>
            ))}
          </div>
        )}
      </div>
      
      <p className="text-gray-400 text-sm mt-2 italic">{description}</p>
    </div>
  );
};


const Checkbox: React.FC<CheckboxProps> = ({ checked, onChange, label, description }) => {
  return (
    <div>
      <h3 className="text-white text-base mb-3">{label}</h3>
      
      <div className="flex items-start gap-3 mb-2">
        <div 
          className={`flex items-center justify-center w-5 h-5 rounded border ${checked ? 'bg-purple-600 border-purple-400' : 'bg-transparent border-gray-500'} cursor-pointer mt-1`}
          onClick={onChange}
        >
          {checked && <Check size={16} className="text-white" />}
        </div>
        <span className="text-white">{label}</span>
      </div>
      
      <p className="text-gray-400 text-sm italic">{description}</p>
    </div>
  );
};


const PrivacySecurityPage: React.FC = () => {
  // State management for all settings
  const [settings, setSettings] = useState({
    twoFactorEnabled: true,
    showActivityStatus: true,
    profileVisibility: "Public (Everyone)"
  });
  
  // Handle all setting changes
  const updateSetting = (key: keyof typeof settings, value: boolean | string) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };
  
  
  const toggleTwoFactor = () => {
    updateSetting('twoFactorEnabled', !settings.twoFactorEnabled);
  };
  
  const toggleActivityStatus = () => {
    updateSetting('showActivityStatus', !settings.showActivityStatus);
  };
  
  const selectVisibilityOption = (option: string) => {
    updateSetting('profileVisibility', option);
  };
  
  // Manage 2FA button click handler
  const handleManage2FA = () => {
    console.log("Managing 2FA...");
    // Implementation for managing 2FA
  };
  
  
  const handleChangePassword = () => {
    console.log("Changing password...");
    
  };
  
  
  const handleSaveChanges = () => {
    console.log("Saving changes...");
    console.log(settings);
    
    alert("Settings saved successfully!");
  };
  
  
  const visibilityOptions = [
    "Public (Everyone)",
    "Friends Only",
    "Private (Only Me)"
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-8xl mx-auto">
        
        <ToggleSection
          title="Two-Factor Authentication"
          description="Your account is protected with an additional verification step using your Authenticator App. You'll need to provide a verification code along with your password when signing in from new devices."
          enabled={settings.twoFactorEnabled}
          onToggle={toggleTwoFactor}
          actionButton={{
            text: "Manage 2FA",
            onClick: handleManage2FA
          }}
        />
        
        {/* Password */}
        <SectionCard>
          <h2 className="text-xl text-purple-400 font-medium mb-2">Password</h2>
          <p className="text-gray-400 text-sm">
            <button 
              className="text-purple-400 hover:underline italic"
              onClick={handleChangePassword}
            >
              Change password
            </button> to improve your account security.
          </p>
        </SectionCard>
        
        
        <SectionCard>
          <h2 className="text-xl text-purple-400 font-medium mb-4">Privacy Controls</h2>
          
          
          <Dropdown
            label="Profile Visibility"
            description="Choose who can see your profile."
            selected={settings.profileVisibility}
            options={visibilityOptions}
            onSelect={selectVisibilityOption}
          />
          
          <hr className="border-gray-700 my-4" />
          
          
          <Checkbox
            label="Show Activity Status"
            description="Others can see when you're active on StreamFi."
            checked={settings.showActivityStatus}
            onChange={toggleActivityStatus}
          />
        </SectionCard>
        
        
        <div className="flex justify-end mb-8">
          <button 
            className="bg-[#5A189A] w-full md:w-auto hover:bg-opacity-90 text-white px-6 py-3 rounded-md transition mb-[4em] lg:mb-0"
            onClick={handleSaveChanges}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrivacySecurityPage;