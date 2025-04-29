'use client'
import React, { useState } from 'react';


interface RadioOptionProps {
  label: string;
  isSelected: boolean;
  onSelect: () => void;
}

interface OptionsSectionProps {
  title: string;
  description: string;
  value: string;
  options: string[];
  onChange: (newValue: string) => void;
}

interface SectionCardProps {
  children: React.ReactNode;
}


const RadioOption: React.FC<RadioOptionProps> = ({ label, isSelected, onSelect }) => {
  return (
    <div className="flex items-center">
      <button 
        className={`w-8 h-8 rounded-full ${isSelected ? 'bg-purple-600' : 'bg-white'} flex items-center justify-center mr-3`}
        onClick={onSelect}
      >
        {isSelected && (
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 6L9 17L4 12" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>
      <span className="text-white text-lg">{label}</span>
    </div>
  );
};


const SectionCard: React.FC<SectionCardProps> = ({ children }) => {
  return (
    <div className="bg-[#1a1a1a] rounded-lg p-6 mb-6">
      {children}
    </div>
  );
};


const OptionsSection: React.FC<OptionsSectionProps> = ({ 
  title, 
  description, 
  value, 
  options, 
  onChange 
}) => {
  // Map option values to display labels
  const getDisplayLabel = (option: string) => {
    const labels: Record<string, string> = {
      'light': 'Light Mode',
      'dark': 'Dark Mode',
      'system': 'System Default'
    };
    return labels[option] || option;
  };

  return (
    <SectionCard>
      <h2 className="text-xl text-purple-600 font-medium mb-2">{title}</h2>
      <p className="text-gray-400 text-sm mb-4 italic">{description}</p>
      
      <div className="space-y-4">
        {options.map((option) => (
          <RadioOption
            key={option}
            label={getDisplayLabel(option)}
            isSelected={value === option}
            onSelect={() => onChange(option)}
          />
        ))}
      </div>
    </SectionCard>
  );
};


const ThemeSettingsPage: React.FC = () => {
  
  const [settings, setSettings] = useState({
    theme: 'dark',
    display: 'dark'
  });

  // Universal handler for updating settings
  const updateSetting = (key: keyof typeof settings, value: string) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  
  const commonOptions = ['light', 'dark', 'system'];

  
  const saveChanges = () => {
    alert('Settings saved!');
    console.log('Settings to save:', settings);
    // Implement actual saving logic here
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-8xl mx-auto">
        
        <OptionsSection
          title="Theme"
          description="Choose between light and dark interface themes"
          value={settings.theme}
          options={commonOptions}
          onChange={(newValue) => updateSetting('theme', newValue)}
        />
        
        {/* Display Selection */}
        <OptionsSection
          title="Display"
          description="Choose between light and dark interface themes"
          value={settings.display}
          options={commonOptions}
          onChange={(newValue) => updateSetting('display', newValue)}
        />
        
        
        <div className="lg:flex lg:justify-end w-full">
          <button
            className="bg-purple-600 hover:bg-purple-700 w-full lg:w-[12em] text-white px-6 py-3 rounded-lg"
            onClick={saveChanges}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default ThemeSettingsPage;