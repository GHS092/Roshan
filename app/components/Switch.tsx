'use client';

import { useState, useEffect } from 'react';

type SwitchProps = {
  label: string;
  tooltip?: string;
  initialValue?: boolean;
  onChange: (value: boolean) => void;
};

export default function Switch({ label, tooltip, initialValue = false, onChange }: SwitchProps) {
  const [isChecked, setIsChecked] = useState(initialValue);
  
  // Sincronizar el estado con initialValue cuando cambie
  useEffect(() => {
    setIsChecked(initialValue);
  }, [initialValue]);

  const handleToggle = () => {
    const newValue = !isChecked;
    setIsChecked(newValue);
    onChange(newValue);
  };

  return (
    <div className="flex items-center gap-2 group">
      <button
        type="button"
        role="switch"
        aria-checked={isChecked}
        onClick={handleToggle}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
          isChecked ? 'bg-indigo-600' : 'bg-gray-200'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            isChecked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
      <span 
        className="text-sm text-gray-700 cursor-pointer" 
        onClick={handleToggle}
      >
        {label}
      </span>
      {tooltip && (
        <div className="relative">
          <div className="flex items-center">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-4 w-4 text-gray-400 cursor-help" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
              />
            </svg>
            <div className="opacity-0 invisible group-hover:opacity-100 group-hover:visible absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg transition-opacity duration-300 whitespace-nowrap">
              {tooltip}
              <div className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-2 h-2 bg-gray-800 transform rotate-45"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 