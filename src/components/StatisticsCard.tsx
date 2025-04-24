'use client';

import { motion } from 'framer-motion';
import { IconType } from 'react-icons';
import { useTheme } from '@/utils/themeContext';

interface StatisticsCardProps {
  title: string;
  value: string | number;
  icon: IconType;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: 'indigo' | 'emerald' | 'amber' | 'rose';
}

export default function StatisticsCard({
  title,
  value,
  icon: Icon,
  trend,
  color = 'indigo'
}: StatisticsCardProps) {
  const { theme } = useTheme();

  // Color mapping
  const colorMap = {
    indigo: {
      light: {
        bg: 'bg-indigo-50',
        text: 'text-indigo-600',
        iconBg: 'bg-indigo-100',
      },
      dark: {
        bg: 'bg-indigo-900/20',
        text: 'text-indigo-400',
        iconBg: 'bg-indigo-800/50',
      }
    },
    emerald: {
      light: {
        bg: 'bg-emerald-50',
        text: 'text-emerald-600',
        iconBg: 'bg-emerald-100',
      },
      dark: {
        bg: 'bg-emerald-900/20',
        text: 'text-emerald-400',
        iconBg: 'bg-emerald-800/50',
      }
    },
    amber: {
      light: {
        bg: 'bg-amber-50',
        text: 'text-amber-600',
        iconBg: 'bg-amber-100',
      },
      dark: {
        bg: 'bg-amber-900/20',
        text: 'text-amber-400',
        iconBg: 'bg-amber-800/50',
      }
    },
    rose: {
      light: {
        bg: 'bg-rose-50',
        text: 'text-rose-600',
        iconBg: 'bg-rose-100',
      },
      dark: {
        bg: 'bg-rose-900/20',
        text: 'text-rose-400',
        iconBg: 'bg-rose-800/50',
      }
    }
  };

  const currentColor = colorMap[color][theme === 'dark' ? 'dark' : 'light'];

  return (
    <motion.div
      className={`${
        theme === 'dark' ? 'glass-card-dark' : 'glass-card-light'
      } p-6 rounded-xl overflow-hidden relative`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -5 }}
    >
      {/* Background decoration */}
      <div className="absolute -right-4 -bottom-4 w-24 h-24 rounded-full opacity-10 bg-current"
        style={{ color: currentColor.text.replace('text-', '') }}></div>

      <div className="flex justify-between items-start">
        <div>
          <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-black'}`}>
            {title}
          </p>
          <h3 className={`text-2xl font-bold mt-1 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
            {value}
          </h3>

          {trend && (
            <div className={`flex items-center mt-2 text-sm ${
              trend.isPositive
                ? theme === 'dark' ? 'text-green-400' : 'text-green-600'
                : theme === 'dark' ? 'text-red-400' : 'text-red-600'
            }`}>
              <svg
                className={`w-3 h-3 mr-1 ${trend.isPositive ? '' : 'transform rotate-180'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 10l7-7m0 0l7 7m-7-7v18"
                />
              </svg>
              <span>{trend.value}%</span>
              <span className="ml-1 text-xs opacity-80">
                {trend.isPositive ? 'increase' : 'decrease'}
              </span>
            </div>
          )}
        </div>

        <div className={`p-3 rounded-lg ${currentColor.iconBg} ${currentColor.text}`}>
          <Icon size={24} />
        </div>
      </div>
    </motion.div>
  );
}
