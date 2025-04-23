'use client';

import { motion } from 'framer-motion';
import { FiSun, FiMoon } from 'react-icons/fi';
import { useTheme } from '@/utils/themeContext';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  
  return (
    <motion.button
      onClick={toggleTheme}
      className={`p-2 rounded-full transition-colors ${
        theme === 'dark' 
          ? 'bg-gray-800 text-yellow-300 hover:bg-gray-700' 
          : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
      }`}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? (
        <motion.div
          initial={{ rotate: 0 }}
          animate={{ rotate: 15 }}
          transition={{ duration: 0.5 }}
        >
          <FiMoon size={20} />
        </motion.div>
      ) : (
        <motion.div
          initial={{ rotate: 0 }}
          animate={{ rotate: 45 }}
          transition={{ duration: 0.5 }}
        >
          <FiSun size={20} />
        </motion.div>
      )}
    </motion.button>
  );
}
