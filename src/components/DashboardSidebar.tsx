'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiHome, FiVideo, FiStar, FiUser, FiSettings,
  FiMail, FiTrendingUp, FiChevronLeft, FiChevronRight,
  FiLogOut, FiCreditCard
} from 'react-icons/fi';
import { useTheme } from '@/utils/themeContext';
import ThemeToggle from './ThemeToggle';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onSignOut: () => void;
  userName?: string;
  userEmail?: string;
}

export default function DashboardSidebar({
  activeTab,
  setActiveTab,
  onSignOut,
  userName,
  userEmail
}: SidebarProps) {
  const { theme } = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navItems = [
    { id: 'overview', label: 'Overview', icon: FiHome },
    { id: 'videos', label: 'Trending Videos', icon: FiVideo },
    { id: 'recommendations', label: 'Recommendations', icon: FiStar },
    { id: 'subscription', label: 'Subscription', icon: FiCreditCard },
    { id: 'profile', label: 'Your Profile', icon: FiUser },
    { id: 'email', label: 'Email Settings', icon: FiMail },
  ];

  return (
    <motion.div
      className={`${
        theme === 'dark' ? 'glass-dark text-gray-200' : 'glass-light text-gray-800'
      } h-screen fixed left-0 top-0 z-30 flex flex-col transition-all duration-300 ease-in-out ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Logo and collapse button */}
      <div className="flex items-center justify-between p-4 border-b border-opacity-20 border-gray-600">
        <AnimatePresence mode="wait">
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center"
            >
              <div className={`font-bold text-xl ${theme === 'dark' ? 'text-white' : 'text-indigo-600'}`}>
                Lazy Trends
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`p-2 rounded-full ${
            theme === 'dark'
              ? 'hover:bg-gray-700 text-gray-300'
              : 'hover:bg-indigo-100 text-indigo-600'
          }`}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          {isCollapsed ? <FiChevronRight /> : <FiChevronLeft />}
        </motion.button>
      </div>

      {/* User info */}
      <div className={`p-4 border-b border-opacity-20 border-gray-600 ${isCollapsed ? 'items-center' : ''}`}>
        <div className="flex items-center mb-2">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            theme === 'dark' ? 'bg-indigo-600' : 'bg-indigo-100'
          } ${theme === 'dark' ? 'text-white' : 'text-indigo-600'}`}>
            {userName ? userName.charAt(0).toUpperCase() : 'U'}
          </div>

          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="ml-3"
              >
                <div className="font-medium">{userName || 'User'}</div>
                <div className="text-xs opacity-70">{userEmail || ''}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-2 px-2">
          {navItems.map((item) => (
            <li key={item.id}>
              <motion.button
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center p-3 rounded-lg transition-colors ${
                  activeTab === item.id
                    ? theme === 'dark'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-indigo-100 text-indigo-800'
                    : theme === 'dark'
                    ? 'text-gray-300 hover:bg-gray-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                whileHover={{ x: 5 }}
                whileTap={{ scale: 0.98 }}
              >
                <item.icon className={`${isCollapsed ? 'mx-auto' : 'mr-3'}`} size={20} />

                <AnimatePresence mode="wait">
                  {!isCollapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Bottom actions */}
      <div className={`p-4 border-t border-opacity-20 border-gray-600 ${
        isCollapsed ? 'flex flex-col items-center space-y-4' : 'space-y-2'
      }`}>
        <AnimatePresence mode="wait">
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex justify-between items-center mb-4"
            >
              <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-black'}`}>
                Theme
              </span>
              <ThemeToggle />
            </motion.div>
          )}
        </AnimatePresence>

        {isCollapsed && (
          <ThemeToggle />
        )}

        <motion.button
          onClick={onSignOut}
          className={`w-full flex items-center p-3 rounded-lg ${
            theme === 'dark'
              ? 'hover:bg-red-900/30 text-red-400'
              : 'hover:bg-red-100 text-red-600'
          }`}
          whileHover={{ x: 5 }}
          whileTap={{ scale: 0.98 }}
        >
          <FiLogOut className={`${isCollapsed ? 'mx-auto' : 'mr-3'}`} size={20} />

          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                Sign Out
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </motion.div>
  );
}
