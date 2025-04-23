'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { FiArrowLeft, FiCheck, FiCreditCard } from 'react-icons/fi';
import { stripePromise } from '@/utils/stripe';
import { supabase } from '@/utils/supabase';
import Link from 'next/link';

export default function CheckoutPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        router.push('/auth/login');
        return;
      }

      setUser(data.session.user);

      // Check if user has already completed onboarding
      const { data: userData, error } = await supabase
        .from('users')
        .select('business_description')
        .eq('id', data.session.user.id)
        .single();

      if (error || !userData.business_description) {
        // User has not completed onboarding, redirect to onboarding
        router.push('/onboarding');
      }
    };

    checkUser();
  }, [router]);

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          price_id: process.env.NEXT_PUBLIC_PRICE_ID,
        }),
      });

      const { sessionId, error } = await response.json();

      if (error) {
        throw new Error(error.message || 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout
      const stripe = await stripePromise;
      if (!stripe) {
        throw new Error('Failed to load Stripe');
      }

      const { error: stripeError } = await stripe.redirectToCheckout({
        sessionId,
      });

      if (stripeError) {
        throw new Error(stripeError.message || 'Stripe redirect error');
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      setError(err.message || 'An error occurred during checkout');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-2 bg-gray-900 text-white">
      <motion.div
        className="w-full max-w-2xl p-8 bg-gray-800 rounded-xl shadow-xl border border-gray-700"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center mb-6">
          <div className="w-12 h-12 rounded-full bg-indigo-600/30 flex items-center justify-center mr-4">
            <FiCreditCard className="text-indigo-400 w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
            Complete Your Subscription
          </h1>
        </div>

        <div className="bg-gray-700/50 p-6 rounded-lg border border-gray-600 mb-8">
          <h2 className="text-xl font-semibold mb-4">Pro Plan</h2>
          <div className="flex items-baseline mb-2">
            <span className="text-3xl font-bold text-white">$39.95</span>
            <span className="text-lg text-indigo-100 ml-1">/month</span>
          </div>
          <p className="text-indigo-100 mb-4">First week free</p>
          
          <ul className="space-y-3 mb-6">
            <li className="flex items-center">
              <FiCheck className="h-5 w-5 text-green-400 mr-3" />
              <span className="text-gray-300">Daily trend analysis</span>
            </li>
            <li className="flex items-center">
              <FiCheck className="h-5 w-5 text-green-400 mr-3" />
              <span className="text-gray-300">Personalized recommendations</span>
            </li>
            <li className="flex items-center">
              <FiCheck className="h-5 w-5 text-green-400 mr-3" />
              <span className="text-gray-300">Daily email updates</span>
            </li>
            <li className="flex items-center">
              <FiCheck className="h-5 w-5 text-green-400 mr-3" />
              <span className="text-gray-300">Actionable content scripts</span>
            </li>
          </ul>
          
          <p className="text-sm text-gray-400 mb-4">Credit card required for trial</p>
        </div>

        {error && (
          <motion.div
            className="bg-red-900/30 border border-red-500 text-red-300 p-4 rounded-lg mb-6 flex items-center"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-red-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </motion.div>
        )}

        <div className="flex justify-between">
          <Link
            href="/onboarding"
            className="px-6 py-3 bg-gray-700 text-white rounded-lg flex items-center hover:bg-gray-600 transition-colors"
          >
            <FiArrowLeft className="mr-2" /> Back
          </Link>

          <motion.button
            onClick={handleCheckout}
            disabled={loading}
            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg flex items-center"
            whileHover={{ scale: loading ? 1 : 1.05 }}
            transition={{ duration: 0.2 }}
          >
            {loading ? 'Processing...' : 'Proceed to Payment'} {!loading && <FiCreditCard className="ml-2" />}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
