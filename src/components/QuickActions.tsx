'use client';

import { motion } from 'framer-motion';
import { FiTrendingUp, FiMail, FiUser, FiRefreshCw, FiDownload } from 'react-icons/fi';
import { useTheme } from '@/utils/themeContext';

interface QuickActionsProps {
  onGenerateTrends: () => void;
  onViewProfile: () => void;
  onViewEmails: () => void;
  isGenerating: boolean;
  hasRecommendations: boolean;
}

export default function QuickActions({
  onGenerateTrends,
  onViewProfile,
  onViewEmails,
  isGenerating,
  hasRecommendations
}: QuickActionsProps) {
  const { theme } = useTheme();

  const actions = [
    {
      id: 'profile',
      label: 'Edit Profile',
      icon: FiUser,
      onClick: onViewProfile,
      disabled: false,
      primary: false
    },
    {
      id: 'email',
      label: 'Email Settings',
      icon: FiMail,
      onClick: onViewEmails,
      disabled: false,
      primary: false
    }
  ];

  // Add download action if recommendations exist
  if (hasRecommendations) {
    actions.push({
      id: 'download',
      label: 'Export Report',
      icon: FiDownload,
      onClick: () => {
        // This would be implemented to download the latest recommendation
        alert('Export functionality would be implemented here');
      },
      disabled: false,
      primary: false
    });
  }

  return (
    <motion.div
      className={`${
        theme === 'dark' ? 'glass-card-dark' : 'glass-card-light'
      } p-4 rounded-xl mb-8`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
    >
      <h3 className={`text-sm font-semibold mb-3 ${
        theme === 'dark' ? 'text-gray-300' : 'text-black'
      }`}>
        Quick Actions
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {actions.map((action, index) => (
          <motion.button
            key={action.id}
            onClick={action.onClick}
            disabled={action.disabled}
            className={`${
              action.primary
                ? theme === 'dark'
                  ? 'glass-button-dark'
                  : 'glass-button-light'
                : theme === 'dark'
                ? 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200'
            } p-3 rounded-lg flex flex-col items-center justify-center h-24 ${
              action.disabled ? 'opacity-60 cursor-not-allowed' : ''
            }`}
            whileHover={action.disabled ? {} : { y: -5 }}
            whileTap={action.disabled ? {} : { scale: 0.95 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 * index }}
          >
            {action.id === 'generate' && isGenerating ? (
              <div className="relative">
                <action.icon size={24} className={`${
                  action.primary ? 'text-white' : theme === 'dark' ? 'text-gray-300' : 'text-black'
                } animate-spin`} />
              </div>
            ) : (
              <action.icon size={24} className={`${
                action.primary ? 'text-white' : theme === 'dark' ? 'text-gray-300' : 'text-black'
              }`} />
            )}
            <span className="mt-2 text-sm text-center">{action.label}</span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
