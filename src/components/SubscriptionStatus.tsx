'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { FiCheck, FiX, FiClock } from 'react-icons/fi';
import ManageSubscriptionButton from './ManageSubscriptionButton';

interface SubscriptionStatusProps {
  className?: string;
}

export default function SubscriptionStatus({ className = '' }: SubscriptionStatusProps) {
  const [status, setStatus] = useState<string | null>(null);
  const [trialEndDate, setTrialEndDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSubscriptionStatus = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setLoading(false);
          return;
        }

        const { data } = await supabase
          .from('users')
          .select('subscription_status, trial_end_date')
          .eq('id', user.id)
          .single();

        if (data) {
          setStatus(data.subscription_status);
          setTrialEndDate(data.trial_end_date);
        }
      } catch (error) {
        console.error('Error fetching subscription status:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscriptionStatus();
  }, []);

  if (loading) {
    return (
      <div className={`p-4 bg-gray-100 rounded-lg ${className}`}>
        <p className="text-gray-500">Loading subscription status...</p>
      </div>
    );
  }

  if (!status || status === 'inactive' || status === 'canceled') {
    return (
      <div className={`p-4 bg-red-50 border border-red-200 rounded-lg ${className}`}>
        <div className="flex items-center mb-2">
          <FiX className="text-red-500 mr-2" />
          <h3 className="font-medium text-red-800">No active subscription</h3>
        </div>
        <p className="text-red-700 mb-4 text-sm">
          You don't have an active subscription. Subscribe to access all features.
        </p>
        <a
          href="/checkout"
          className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
        >
          Subscribe Now
        </a>
      </div>
    );
  }

  if (status === 'trialing') {
    const trialEnd = trialEndDate ? new Date(trialEndDate) : null;
    const daysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;

    return (
      <div className={`p-4 bg-blue-50 border border-blue-200 rounded-lg ${className}`}>
        <div className="flex items-center mb-2">
          <FiClock className="text-blue-500 mr-2" />
          <h3 className="font-medium text-blue-800">Trial Subscription</h3>
        </div>
        <p className="text-blue-700 mb-4 text-sm">
          {daysLeft > 0
            ? `Your trial ends in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}.`
            : 'Your trial is ending today.'}
        </p>
        <ManageSubscriptionButton className="bg-blue-600 hover:bg-blue-700" />
      </div>
    );
  }

  if (status === 'past_due') {
    return (
      <div className={`p-4 bg-yellow-50 border border-yellow-200 rounded-lg ${className}`}>
        <div className="flex items-center mb-2">
          <FiX className="text-yellow-500 mr-2" />
          <h3 className="font-medium text-yellow-800">Payment Issue</h3>
        </div>
        <p className="text-yellow-700 mb-4 text-sm">
          There was an issue with your last payment. Please update your payment method.
        </p>
        <ManageSubscriptionButton className="bg-yellow-600 hover:bg-yellow-700" />
      </div>
    );
  }

  return (
    <div className={`p-4 bg-green-50 border border-green-200 rounded-lg ${className}`}>
      <div className="flex items-center mb-2">
        <FiCheck className="text-green-500 mr-2" />
        <h3 className="font-medium text-green-800">Active Subscription</h3>
      </div>
      <p className="text-green-700 mb-4 text-sm">
        Your subscription is active. You have access to all features.
      </p>
      <ManageSubscriptionButton className="bg-green-600 hover:bg-green-700" />
    </div>
  );
}
