'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { motion } from 'framer-motion';
import { FiArrowRight, FiArrowLeft, FiCheck, FiUser, FiClock, FiStar } from 'react-icons/fi';

// Onboarding steps
const STEPS = {
  BUSINESS_DESCRIPTION: 0,
  TIME_COMMITMENT: 1,
  EXPERIENCE_LEVEL: 2,
  SUMMARY: 3,
};

export default function Onboarding() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(STEPS.BUSINESS_DESCRIPTION);
  const [businessDescription, setBusinessDescription] = useState('');
  const [timeCommitment, setTimeCommitment] = useState<number>(5);
  const [experienceLevel, setExperienceLevel] = useState<'beginner' | 'intermediate' | 'expert'>('beginner');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Check if user is authenticated
  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        router.push('/auth/login');
        return;
      }

      setUserId(data.session.user.id);

      // Check if user has already completed onboarding
      const { data: userData, error } = await supabase
        .from('users')
        .select('business_description')
        .eq('id', data.session.user.id)
        .single();

      if (!error && userData.business_description) {
        // User has already completed onboarding, redirect to dashboard
        router.push('/dashboard');
      }
    };

    checkUser();
  }, [router]);

  const nextStep = () => {
    setCurrentStep((prev) => prev + 1);
  };

  const prevStep = () => {
    setCurrentStep((prev) => prev - 1);
  };

  const handleSubmit = async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      // Update user profile with onboarding data
      const { error } = await supabase
        .from('users')
        .update({
          business_description: businessDescription,
          weekly_time_commitment: timeCommitment,
          social_media_experience: experienceLevel,
        })
        .eq('id', userId);

      if (error) {
        throw error;
      }

      // Redirect to dashboard
      router.push('/dashboard');
    } catch (error: any) {
      setError(error.message || 'An error occurred during onboarding');
      console.error('Error saving onboarding data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Render different content based on current step
  const renderStepContent = () => {
    switch (currentStep) {
      case STEPS.BUSINESS_DESCRIPTION:
        return (
          <motion.div
            className="space-y-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center mb-2">
              <div className="w-10 h-10 rounded-full bg-indigo-600/30 flex items-center justify-center mr-3">
                <FiUser className="text-indigo-400" />
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
                Tell us about your business
              </h2>
            </div>
            <p className="text-gray-300">
              This helps us generate relevant TikTok content ideas for your niche.
            </p>
            <textarea
              className="w-full p-4 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white placeholder-gray-400"
              rows={5}
              placeholder="e.g., I run a pet grooming salon that specializes in small dogs..."
              value={businessDescription}
              onChange={(e) => setBusinessDescription(e.target.value)}
              required
            />
          </motion.div>
        );

      case STEPS.TIME_COMMITMENT:
        return (
          <motion.div
            className="space-y-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center mb-2">
              <div className="w-10 h-10 rounded-full bg-purple-600/30 flex items-center justify-center mr-3">
                <FiClock className="text-purple-400" />
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
                How much time can you commit weekly?
              </h2>
            </div>
            <p className="text-gray-300">
              This helps us recommend a sustainable content strategy.
            </p>
            <div className="flex items-center space-x-4 mt-6">
              <input
                type="range"
                min="1"
                max="20"
                value={timeCommitment}
                onChange={(e) => setTimeCommitment(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <span className="text-lg font-medium bg-gray-700 px-4 py-2 rounded-lg min-w-[90px] text-center">
                {timeCommitment} hours
              </span>
            </div>
          </motion.div>
        );

      case STEPS.EXPERIENCE_LEVEL:
        return (
          <motion.div
            className="space-y-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center mb-2">
              <div className="w-10 h-10 rounded-full bg-blue-600/30 flex items-center justify-center mr-3">
                <FiStar className="text-blue-400" />
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
                What's your social media experience level?
              </h2>
            </div>
            <p className="text-gray-300">
              This helps us tailor our recommendations to your skill level.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              {[{ name: 'beginner', label: 'Beginner' }, { name: 'intermediate', label: 'Intermediate' }, { name: 'expert', label: 'Expert' }].map((level) => (
                <motion.div
                  key={level.name}
                  className={`p-4 rounded-lg border-2 cursor-pointer ${experienceLevel === level.name ? 'bg-indigo-600/20 border-indigo-500' : 'bg-gray-700/50 border-gray-600 hover:border-gray-500'}`}
                  onClick={() => setExperienceLevel(level.name as any)}
                  whileHover={{ y: -5 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-center">
                    <div className={`w-5 h-5 rounded-full mr-3 flex items-center justify-center ${experienceLevel === level.name ? 'bg-indigo-500' : 'bg-gray-600'}`}>
                      {experienceLevel === level.name && <FiCheck className="text-white text-xs" />}
                    </div>
                    <label htmlFor={level.name} className="text-lg font-medium cursor-pointer">
                      {level.label}
                    </label>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        );

      case STEPS.SUMMARY:
        return (
          <motion.div
            className="space-y-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center mb-2">
              <div className="w-10 h-10 rounded-full bg-green-600/30 flex items-center justify-center mr-3">
                <FiCheck className="text-green-400" />
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
                Review your information
              </h2>
            </div>
            <div className="bg-gray-700/50 p-6 rounded-lg border border-gray-600">
              <div className="mb-6">
                <h3 className="font-medium text-indigo-400 mb-2">Business Description:</h3>
                <p className="text-gray-300 bg-gray-800/50 p-3 rounded-lg border border-gray-600">{businessDescription}</p>
              </div>
              <div className="mb-6">
                <h3 className="font-medium text-indigo-400 mb-2">Weekly Time Commitment:</h3>
                <p className="text-gray-300 bg-gray-800/50 p-3 rounded-lg border border-gray-600">{timeCommitment} hours</p>
              </div>
              <div>
                <h3 className="font-medium text-indigo-400 mb-2">Experience Level:</h3>
                <p className="text-gray-300 bg-gray-800/50 p-3 rounded-lg border border-gray-600 capitalize">{experienceLevel}</p>
              </div>
            </div>
          </motion.div>
        );

      default:
        return null;
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
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {Object.keys(STEPS).map((step, index) => (
              <motion.div
                key={step}
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  currentStep >= index
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
                    : 'bg-gray-700 text-gray-400'
                }`}
                whileHover={{ scale: 1.1 }}
                transition={{ duration: 0.2 }}
              >
                {index + 1}
              </motion.div>
            ))}
          </div>
          <div className="w-full bg-gray-700 h-2 rounded-full">
            <motion.div
              className="bg-gradient-to-r from-indigo-600 to-purple-600 h-2 rounded-full"
              style={{ width: `${(currentStep / (Object.keys(STEPS).length - 1)) * 100}%` }}
              initial={{ width: 0 }}
              animate={{ width: `${(currentStep / (Object.keys(STEPS).length - 1)) * 100}%` }}
              transition={{ duration: 0.5 }}
            ></motion.div>
          </div>
        </div>

        {/* Step content */}
        <div className="mb-8">
          {renderStepContent()}
        </div>

        {/* Error message */}
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

        {/* Navigation buttons */}
        <div className="flex justify-between">
          <motion.button
            onClick={prevStep}
            disabled={currentStep === 0 || loading}
            className={`px-6 py-3 rounded-lg flex items-center ${
              currentStep === 0
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-gray-700 text-white hover:bg-gray-600'
            }`}
            whileHover={{ scale: currentStep === 0 ? 1 : 1.05 }}
            transition={{ duration: 0.2 }}
          >
            <FiArrowLeft className="mr-2" /> Back
          </motion.button>

          {currentStep < STEPS.SUMMARY ? (
            <motion.button
              onClick={nextStep}
              disabled={currentStep === STEPS.BUSINESS_DESCRIPTION && !businessDescription.trim()}
              className={`px-6 py-3 rounded-lg flex items-center ${
                currentStep === STEPS.BUSINESS_DESCRIPTION && !businessDescription.trim()
                  ? 'bg-indigo-600/50 cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white'
              }`}
              whileHover={{ scale: currentStep === STEPS.BUSINESS_DESCRIPTION && !businessDescription.trim() ? 1 : 1.05 }}
              transition={{ duration: 0.2 }}
            >
              Next <FiArrowRight className="ml-2" />
            </motion.button>
          ) : (
            <motion.button
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg flex items-center"
              whileHover={{ scale: loading ? 1 : 1.05 }}
              transition={{ duration: 0.2 }}
            >
              {loading ? 'Saving...' : 'Complete Onboarding'} {!loading && <FiCheck className="ml-2" />}
            </motion.button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
