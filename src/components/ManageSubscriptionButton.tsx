'use client';

import { useState } from 'react';
import { FiCreditCard } from 'react-icons/fi';

interface ManageSubscriptionButtonProps {
  className?: string;
}

export default function ManageSubscriptionButton({ className = '' }: ManageSubscriptionButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleManageSubscription = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to create portal session');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error('Error creating portal session:', error);
      alert('Failed to open subscription management portal. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleManageSubscription}
      disabled={isLoading}
      className={`flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors ${
        isLoading ? 'opacity-70 cursor-not-allowed' : ''
      } ${className}`}
    >
      {isLoading ? 'Loading...' : 'Manage Subscription'} {!isLoading && <FiCreditCard className="ml-2" />}
    </button>
  );
}
