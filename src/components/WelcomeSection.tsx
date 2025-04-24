'use client';

import { motion } from 'framer-motion';
import { FiTrendingUp, FiClock } from 'react-icons/fi';
import { useTheme } from '@/utils/themeContext';

interface WelcomeSectionProps {
  userName?: string;
  lastUpdateTime?: string;
  isGenerating: boolean;
  onGenerateTrends: () => void;
}

export default function WelcomeSection({
  userName,
  lastUpdateTime,
  isGenerating,
  onGenerateTrends
}: WelcomeSectionProps) {
  const { theme } = useTheme();

  // Get time of day greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Format date
  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <motion.div
      className={`${
        theme === 'dark' ? 'glass-card-dark' : 'glass-card-light'
      } p-6 rounded-xl mb-8`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <motion.h1
            className={`text-3xl font-bold mb-2 ${
              theme === 'dark' ? 'text-white' : 'text-gray-800'
            }`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            {getGreeting()}, {userName || 'Creator'}!
          </motion.h1>

          <motion.p
            className={`${
              theme === 'dark' ? 'text-gray-300' : 'text-black'
            }`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            {formattedDate}
          </motion.p>

          {lastUpdateTime && (
            <motion.div
              className={`flex items-center mt-2 text-sm ${
                theme === 'dark' ? 'text-gray-400' : 'text-black'
              }`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <FiClock className="mr-1" />
              <span>Last trend update: {lastUpdateTime}</span>
            </motion.div>
          )}
        </div>

        {/* Button removed as analysis is triggered automatically */}
      </div>

      {isGenerating && (
        <motion.div
          className={`mt-4 p-3 rounded-lg ${
            theme === 'dark' ? 'bg-indigo-900/30' : 'bg-indigo-50'
          } flex items-center`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="relative mr-3">
            <div className="w-5 h-5 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin"></div>
          </div>
          <p className={`text-sm ${theme === 'dark' ? 'text-indigo-300' : 'text-indigo-700'}`}>
            Analyzing TikTok trends for your business. This may take a few minutes...
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
