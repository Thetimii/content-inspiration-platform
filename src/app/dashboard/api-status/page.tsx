'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiRefreshCw, FiAlertCircle, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import { useTheme } from '@/utils/themeContext';

export default function ApiStatusPage() {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<any>(null);
  const [envStatus, setEnvStatus] = useState<any>(null);

  const checkApiStatus = async () => {
    setLoading(true);
    setError(null);

    try {
      // Check OpenRouter API status
      const apiResponse = await fetch('/api/test-openrouter');
      const apiData = await apiResponse.json();

      if (apiResponse.ok) {
        setApiStatus(apiData);
      } else {
        setError(apiData.error || 'Failed to check API status');
        setApiStatus(apiData);
      }

      // Check environment variables
      const envResponse = await fetch('/api/env-check');
      const envData = await envResponse.json();

      if (envResponse.ok) {
        setEnvStatus(envData);
      } else {
        console.error('Failed to check environment variables:', envData);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while checking API status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkApiStatus();
  }, []);

  return (
    <div className={`p-6 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">API Status</h1>
          <button
            onClick={checkApiStatus}
            disabled={loading}
            className={`flex items-center px-4 py-2 rounded-lg ${
              loading
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            } transition-colors`}
          >
            <FiRefreshCw className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className={`mb-6 p-4 rounded-lg ${theme === 'dark' ? 'bg-red-900/30 text-red-200' : 'bg-red-50 text-red-800'}`}>
            <p className="flex items-center">
              <FiAlertCircle className="mr-2" />
              {error}
            </p>
          </div>
        )}

        <div className={`mb-8 p-6 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} shadow-md`}>
          <h2 className="text-xl font-semibold mb-4">OpenRouter API Status</h2>

          {loading ? (
            <div className="flex justify-center items-center p-8">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
          ) : apiStatus ? (
            <div className="space-y-4">
              <div className="flex items-center">
                <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                  apiStatus.error
                    ? 'bg-red-100 text-red-600'
                    : 'bg-green-100 text-green-600'
                }`}>
                  {apiStatus.error ? <FiXCircle className="h-5 w-5" /> : <FiCheckCircle className="h-5 w-5" />}
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-medium">
                    {apiStatus.error ? 'API Key Invalid' : 'API Key Valid'}
                  </h3>
                  <p className={`mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-black'}`}>
                    {apiStatus.error
                      ? 'The OpenRouter API key is invalid or not properly configured.'
                      : 'The OpenRouter API key is valid and working correctly.'}
                  </p>
                </div>
              </div>

              <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                <h4 className="font-medium mb-2">API Key Details</h4>
                <div className="space-y-2">
                  {apiStatus.apiKeyFirstFiveChars && (
                    <p>
                      <span className="font-medium">API Key Prefix:</span>{' '}
                      {apiStatus.apiKeyFirstFiveChars}...
                    </p>
                  )}
                  <p>
                    <span className="font-medium">API Key Length:</span>{' '}
                    {apiStatus.apiKeyLength || 'N/A'} characters
                  </p>
                  {apiStatus.status && (
                    <p>
                      <span className="font-medium">Status:</span>{' '}
                      {apiStatus.status}
                    </p>
                  )}
                  {apiStatus.responseStatus && (
                    <p>
                      <span className="font-medium">Response Status:</span>{' '}
                      {apiStatus.responseStatus}
                    </p>
                  )}
                  {apiStatus.model && (
                    <p>
                      <span className="font-medium">Model:</span>{' '}
                      {apiStatus.model}
                    </p>
                  )}
                </div>
              </div>

              {apiStatus.error && apiStatus.message && (
                <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-red-900/30' : 'bg-red-50'}`}>
                  <h4 className={`font-medium mb-2 ${theme === 'dark' ? 'text-red-200' : 'text-red-800'}`}>
                    Error Details
                  </h4>
                  <p className={theme === 'dark' ? 'text-red-200' : 'text-red-800'}>
                    {apiStatus.message}
                  </p>
                  {apiStatus.data && (
                    <pre className={`mt-2 p-2 rounded text-sm overflow-x-auto ${theme === 'dark' ? 'bg-red-900/50 text-red-100' : 'bg-red-100 text-red-900'}`}>
                      {apiStatus.data}
                    </pre>
                  )}
                </div>
              )}

              {apiStatus.content && (
                <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                  <h4 className="font-medium mb-2">Test Response</h4>
                  <p className="italic">{apiStatus.content}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-center p-4">No API status information available.</p>
          )}
        </div>

        {/* Environment Variables Status */}
        {envStatus && (
          <div className={`mb-8 p-6 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} shadow-md`}>
            <h2 className="text-xl font-semibold mb-4">Environment Variables</h2>

            <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'} mb-4`}>
              <h3 className="font-medium mb-2">Environment Status</h3>
              <div className="space-y-2">
                <p>
                  <span className="font-medium">Environment:</span>{' '}
                  {envStatus.environment || 'N/A'}
                </p>
                <p>
                  <span className="font-medium">Process.env Available:</span>{' '}
                  {envStatus.hasProcessEnv ? 'Yes' : 'No'}
                </p>
                <p>
                  <span className="font-medium">Next.config.ts Working:</span>{' '}
                  {envStatus.nextConfigWorking ? 'Yes' : 'No'}
                </p>
              </div>
            </div>

            <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
              <h3 className="font-medium mb-2">Environment Variables</h3>
              <div className="space-y-2">
                {Object.entries(envStatus.environmentVariables || {}).map(([key, value]) => (
                  <p key={key}>
                    <span className="font-medium">{key}:</span>{' '}
                    <span className={value === 'not set' ? 'text-red-500' : ''}>{value}</span>
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className={`p-6 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} shadow-md`}>
          <h2 className="text-xl font-semibold mb-4">Troubleshooting</h2>

          <div className="space-y-4">
            <p>
              If the OpenRouter API key is invalid or not working, please check the following:
            </p>

            <ol className="list-decimal list-inside space-y-2 ml-4">
              <li>Verify that the API key is correctly set in the Vercel environment variables.</li>
              <li>Make sure the API key has not expired or been revoked.</li>
              <li>Check if the API key has sufficient credits or if you've reached your usage limit.</li>
              <li>Ensure that the API key has the necessary permissions to access the required models.</li>
              <li>Try regenerating a new API key from the OpenRouter dashboard.</li>
            </ol>

            <p className="mt-4">
              For more information, visit the{' '}
              <a
                href="https://openrouter.ai/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:text-indigo-800 underline"
              >
                OpenRouter documentation
              </a>.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
