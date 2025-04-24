'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/utils/supabase';
import { FiMail, FiClock, FiCheck, FiX } from 'react-icons/fi';
import { useTheme } from '@/utils/themeContext';

interface EmailPreferencesProps {
  userId: string;
}

export default function EmailPreferences({ userId }: EmailPreferencesProps) {
  const { theme, isDarkMode } = useTheme();
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [emailHour, setEmailHour] = useState(9);
  const [emailMinute, setEmailMinute] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load user preferences
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('email_notifications, email_time_hour, email_time_minute')
          .eq('id', userId)
          .single();

        if (error) {
          throw error;
        }

        if (data) {
          setEmailNotifications(data.email_notifications ?? true);
          setEmailHour(data.email_time_hour ?? 9);
          setEmailMinute(data.email_time_minute ?? 0);
        }
      } catch (error) {
        console.error('Error loading email preferences:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, [userId]);

  // Save preferences
  const savePreferences = async () => {
    setSaving(true);
    setSuccess(false);
    setError(null);

    try {
      const { error } = await supabase
        .from('users')
        .update({
          email_notifications: emailNotifications,
          email_time_hour: emailHour,
          email_time_minute: emailMinute,
        })
        .eq('id', userId);

      if (error) {
        throw error;
      }

      setSuccess(true);

      // Reset success message after 3 seconds
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
    } catch (error: any) {
      console.error('Error saving email preferences:', error);
      setError(error.message || 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  // Generate time options
  const hourOptions = Array.from({ length: 24 }, (_, i) => i);
  const minuteOptions = [0, 15, 30, 45];

  // Format time for display
  const formatTime = (hour: number, minute: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    const displayMinute = minute.toString().padStart(2, '0');
    return `${displayHour}:${displayMinute} ${period}`;
  };

  if (loading) {
    return (
      <div className={`animate-pulse p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <div className={`h-6 rounded w-1/3 mb-4 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
        <div className={`h-10 rounded mb-4 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
        <div className={`h-10 rounded mb-4 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
        <div className={`h-10 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
      </div>
    );
  }

  return (
    <motion.div
      className={`${theme === 'dark' ? 'glass-card-dark' : 'glass-card-light'} p-6 rounded-xl`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <h2 className={`text-xl font-semibold mb-4 flex items-center ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
        <FiMail className={`mr-2 ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`} />
        Email Preferences
      </h2>

      <div className="space-y-6">
        {/* Email notifications toggle */}
        <div>
          <label className="flex items-center cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only"
                checked={emailNotifications}
                onChange={() => setEmailNotifications(!emailNotifications)}
              />
              <div className={`block w-14 h-8 rounded-full transition-colors ${
                emailNotifications ? 'bg-indigo-600' : 'bg-gray-300'
              }`}></div>
              <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${
                emailNotifications ? 'transform translate-x-6' : ''
              }`}></div>
            </div>
            <div className={`ml-3 font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
              Receive daily recommendation emails
            </div>
          </label>
          <p className={`text-sm mt-1 ml-16 ${theme === 'dark' ? 'text-gray-400' : 'text-black'}`}>
            Get your latest TikTok trend recommendations delivered to your inbox
          </p>
        </div>

        {/* Email time preference */}
        {emailNotifications && (
          <div className="ml-16">
            <label className={`block text-sm font-medium mb-2 flex items-center ${theme === 'dark' ? 'text-gray-300' : 'text-black'}`}>
              <FiClock className={`mr-2 ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-500'}`} />
              Preferred delivery time (UTC)
            </label>
            <div className="flex items-center space-x-2">
              <select
                value={emailHour}
                onChange={(e) => setEmailHour(parseInt(e.target.value))}
                className={`block w-24 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              >
                {hourOptions.map((hour) => (
                  <option key={hour} value={hour}>
                    {hour.toString().padStart(2, '0')}
                  </option>
                ))}
              </select>
              <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>:</span>
              <select
                value={emailMinute}
                onChange={(e) => setEmailMinute(parseInt(e.target.value))}
                className={`block w-24 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              >
                {minuteOptions.map((minute) => (
                  <option key={minute} value={minute}>
                    {minute.toString().padStart(2, '0')}
                  </option>
                ))}
              </select>
              <span className={`text-sm ml-2 ${theme === 'dark' ? 'text-gray-400' : 'text-black'}`}>
                ({formatTime(emailHour, emailMinute)} UTC)
              </span>
            </div>
            <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-black'}`}>
              Your local time may differ based on your timezone
            </p>
          </div>
        )}

        {/* Save button */}
        <div className={`flex items-center justify-between pt-4 border-t ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
          <div>
            {success && (
              <motion.div
                className="flex items-center text-green-600"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <FiCheck className="mr-1" />
                <span>Preferences saved!</span>
              </motion.div>
            )}
            {error && (
              <motion.div
                className="flex items-center text-red-600"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <FiX className="mr-1" />
                <span>{error}</span>
              </motion.div>
            )}
          </div>
          <motion.button
            onClick={savePreferences}
            disabled={saving}
            className={`px-4 py-2 rounded-md text-white ${
              saving ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
            whileHover={saving ? {} : { scale: 1.05 }}
            whileTap={saving ? {} : { scale: 0.95 }}
          >
            {saving ? 'Saving...' : 'Save Preferences'}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
