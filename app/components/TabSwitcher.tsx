'use client';
import { useState } from 'react';

type Tab = {
  id: string;
  label: string;
  icon: React.ReactNode;
};

type TabSwitcherProps = {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
};

export default function TabSwitcher({ tabs, activeTab, onTabChange }: TabSwitcherProps) {
  return (
    <div className="flex space-x-2 p-1 bg-gray-100 rounded-xl mb-6 shadow-sm">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex-1 flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
            activeTab === tab.id
              ? 'bg-white shadow-md text-indigo-700'
              : 'text-gray-600 hover:bg-white/50 hover:text-indigo-600'
          }`}
        >
          <span className="mr-2">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </div>
  );
} 