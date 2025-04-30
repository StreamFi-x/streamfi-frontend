"use client";
import React from "react";
import Image from "next/image";
import { X } from "lucide-react";

interface LanguageSelectionModalProps {
  currentLanguage: string;
  onClose: () => void;
  onSelectLanguage: (language: string) => void;
}

const languages = [
  { code: "en", name: "English", flag: "/images/flags/en.svg" },
  { code: "es", name: "Spanish", flag: "/images/flags/es.svg" },
  { code: "fr", name: "French", flag: "/images/flags/fr.svg" },
  { code: "de", name: "German", flag: "/images/flags/de.svg" },
  { code: "pt", name: "Portuguese", flag: "/images/flags/pt.svg" },
  { code: "ru", name: "Russian", flag: "/images/flags/ru.svg" },
  { code: "zh", name: "Chinese", flag: "/images/flags/zh.svg" },
  { code: "ja", name: "Japanese", flag: "/images/flags/ja.svg" },
];

export default function LanguageSelectionModal({
  currentLanguage,
  onClose,
  onSelectLanguage,
}: LanguageSelectionModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-[#1a1a1a] rounded-lg w-full max-w-md p-6 relative">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-purple-500 text-xl font-medium">Select Language</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto">
          {languages.map((language) => (
            <div
              key={language.code}
              onClick={() => {
                onSelectLanguage(language.name);
                onClose();
              }}
              className={`flex items-center gap-3 p-3 rounded-md cursor-pointer ${
                currentLanguage === language.name
                  ? "bg-purple-900 bg-opacity-50"
                  : "bg-[#2a2a2a] hover:bg-[#333]"
              }`}
            >
              <div className="w-8 h-8 relative overflow-hidden rounded-full border border-gray-700">
                <Image
                  src={language.flag}
                  alt={language.name}
                  fill
                  className="object-cover"
                />
              </div>
              <span className="text-sm">{language.name}</span>
              {currentLanguage === language.name && (
                <div className="ml-auto w-2 h-2 rounded-full bg-purple-500"></div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="bg-purple-700 hover:bg-purple-800 text-white px-6 py-2 rounded-md transition text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}