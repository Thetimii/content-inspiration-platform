'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiCreditCard, FiAlertCircle, FiCheck, FiX } from 'react-icons/fi';
import { supabase } from '@/utils/supabase';
import { useTheme } from '@/utils/themeContext';
import ManageSubscriptionButton from '@/components/ManageSubscriptionButton';

export default function SubscriptionContent() {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('users')
          .select('subscription_status, trial_end_date, stripe_subscription_id, stripe_customer_id, cancel_at')
          .eq('id', user.id)
          .single();

        if (error) {
          throw error;
        }

        setSubscription(data);
      } catch (error: any) {
        console.error('Error fetching subscription:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, []);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return null;

    const statusConfig: Record<string, { color: string, icon: any, text: string }> = {
      active: {
        color: theme === 'dark' ? 'bg-green-800 text-green-200' : 'bg-green-100 text-green-800',
        icon: FiCheck,
        text: 'Active'
      },
      trialing: {
        color: theme === 'dark' ? 'bg-blue-800 text-blue-200' : 'bg-blue-100 text-blue-800',
        icon: FiCreditCard,
        text: 'Trial'
      },
      canceled_at_period_end: {
        color: theme === 'dark' ? 'bg-orange-800 text-orange-200' : 'bg-orange-100 text-orange-800',
        icon: FiX,
        text: 'Canceling Soon'
      },
      past_due: {
        color: theme === 'dark' ? 'bg-yellow-800 text-yellow-200' : 'bg-yellow-100 text-yellow-800',
        icon: FiAlertCircle,
        text: 'Past Due'
      },
      canceled: {
        color: theme === 'dark' ? 'bg-red-800 text-red-200' : 'bg-red-100 text-red-800',
        icon: FiX,
        text: 'Canceled'
      },
      canceled_at_period_end: {
        color: theme === 'dark' ? 'bg-orange-800 text-orange-200' : 'bg-orange-100 text-orange-800',
        icon: FiX,
        text: 'Canceling Soon'
      },
      incomplete: {
        color: theme === 'dark' ? 'bg-gray-800 text-gray-200' : 'bg-gray-100 text-gray-800',
        icon: FiAlertCircle,
        text: 'Incomplete'
      }
    };

    const config = statusConfig[status] || {
      color: theme === 'dark' ? 'bg-gray-800 text-gray-200' : 'bg-gray-100 text-gray-800',
      icon: FiAlertCircle,
      text: status.charAt(0).toUpperCase() + status.slice(1)
    };

    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="mr-1 h-3 w-3" />
        {config.text}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className={`mb-6 p-4 rounded-lg ${theme === 'dark' ? 'bg-red-900/30 text-red-200' : 'bg-red-50 text-red-800'}`}>
          <p className="flex items-center">
            <FiAlertCircle className="mr-2" />
            {error}
          </p>
        </div>
      )}

      <div className={`p-6 rounded-lg ${theme === 'dark' ? 'glass-card-dark' : 'glass-card-light'} shadow-md`}>
        <h2 className="text-xl font-semibold mb-4">Subscription Details</h2>

        {!subscription?.subscription_status || subscription?.subscription_status === 'canceled' ? (
          <div className="space-y-6">
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700">
              <p className="flex items-center">
                <FiAlertCircle className="mr-2 text-yellow-500" />
                You don't have an active subscription.
              </p>
            </div>

            <div className="flex flex-col items-center justify-center p-8 border border-dashed rounded-lg border-gray-300">
              <h3 className="text-lg font-medium mb-2">Subscribe to Lazy Trends Pro</h3>
              <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-900'} mb-6 text-center max-w-md`}>
                Get access to all features including daily trend analysis, personalized recommendations, and more.
              </p>
              <a
                href="/checkout"
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Subscribe Now
              </a>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-900'} mb-1`}>Subscription Status</p>
                <div className="flex items-center">
                  {getStatusBadge(subscription?.subscription_status)}
                </div>
              </div>

              {subscription?.trial_end_date && subscription?.subscription_status === 'trialing' && (
                <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                  <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-900'} mb-1`}>Trial Ends On</p>
                  <p className="font-medium">{formatDate(subscription.trial_end_date)}</p>
                </div>
              )}

              {subscription?.cancel_at && (
                <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                  <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-900'} mb-1`}>Subscription Ends On</p>
                  <p className="font-medium">{formatDate(subscription.cancel_at)}</p>
                </div>
              )}

              <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-900'} mb-1`}>Plan</p>
                <p className="font-medium">Lazy Trends Pro</p>
              </div>

              <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-900'} mb-1`}>Price</p>
                <p className="font-medium">$39.95/month</p>
              </div>
            </div>

            <div className="flex flex-col items-center border-t border-gray-200 pt-6 mt-6">
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-900'} mb-4 text-center`}>
                Manage your subscription, update payment method, or cancel your plan.
              </p>
              <ManageSubscriptionButton className="px-6 py-3" />
            </div>
          </div>
        )}
      </div>

      <div className={`p-6 rounded-lg ${theme === 'dark' ? 'glass-card-dark' : 'glass-card-light'} shadow-md`}>
        <h2 className="text-xl font-semibold mb-4">Subscription Benefits</h2>

        <div className="space-y-4">
          <div className="flex items-start">
            <div className={`flex-shrink-0 h-5 w-5 ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`}>
              <FiCheck className="h-5 w-5" />
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-medium">Daily Trend Analysis</h3>
              <p className={`mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-900'}`}>
                Get daily updates on the latest TikTok trends relevant to your business.
              </p>
            </div>
          </div>

          <div className="flex items-start">
            <div className={`flex-shrink-0 h-5 w-5 ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`}>
              <FiCheck className="h-5 w-5" />
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-medium">Personalized Recommendations</h3>
              <p className={`mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                Receive tailored content recommendations based on your business niche.
              </p>
            </div>
          </div>

          <div className="flex items-start">
            <div className={`flex-shrink-0 h-5 w-5 ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`}>
              <FiCheck className="h-5 w-5" />
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-medium">Daily Email Updates</h3>
              <p className={`mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                Get recommendations delivered to your inbox at your preferred time.
              </p>
            </div>
          </div>

          <div className="flex items-start">
            <div className={`flex-shrink-0 h-5 w-5 ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`}>
              <FiCheck className="h-5 w-5" />
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-medium">Actionable Content Scripts</h3>
              <p className={`mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                Receive detailed content scripts and ideas based on trending videos.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
