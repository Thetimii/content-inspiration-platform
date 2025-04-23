'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';
import { useTheme } from '@/utils/themeContext';
import { motion } from 'framer-motion';

export default function Login() {
  const router = useRouter();
  const { theme, isDarkMode } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      console.log('Attempting login with email:', email);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Supabase auth error:', error.message);
        throw error;
      }

      if (data.user) {
        console.log('Login successful, checking user data');

        // Check if user has completed onboarding
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('business_description')
          .eq('id', data.user.id)
          .single();

        if (userError) {
          console.error('Error fetching user data:', userError.message);
          throw userError;
        }

        // If business_description is null, user hasn't completed onboarding
        if (!userData || !userData.business_description) {
          console.log('User needs to complete onboarding');
          router.push('/onboarding');
        } else {
          console.log('User has completed onboarding, redirecting to dashboard');
          router.push('/dashboard');
        }
      }
    } catch (error: any) {
      const errorMessage = error.message || 'An error occurred during login';
      console.error('Error logging in:', errorMessage);

      // Provide more user-friendly error messages
      if (errorMessage.includes('Invalid login credentials')) {
        setError('Invalid email or password. Please try again.');
      } else if (errorMessage.includes('rate limit')) {
        setError('Too many login attempts. Please try again later.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-2 bg-gray-900">
      <motion.div
        className="w-full max-w-md space-y-8 p-10 rounded-xl shadow-md bg-gray-800 border border-gray-700"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-300">
            Or{' '}
            <Link href="/auth/signup" className="font-medium text-indigo-500 hover:text-indigo-400">
              create a new account
            </Link>
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email-address" className="sr-only">
                Email address
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-600 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm rounded-t-md bg-gray-700 placeholder-gray-400 text-white"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-600 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm rounded-b-md bg-gray-700 placeholder-gray-400 text-white"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-500 text-red-300 px-4 py-3 rounded-lg relative" role="alert">
              <strong className="font-bold">Error: </strong>
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-300 transform hover:scale-105"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
