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
  const [dbApiStatus, setDbApiStatus] = useState<any[]>([]);

  const checkApiStatus = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get API status from the database and run a live check
      const statusResponse = await fetch('/api/get-api-status');
      const statusData = await statusResponse.json();

      if (statusResponse.ok) {
        setDbApiStatus(statusData.apiStatus || []);
        setEnvStatus({
          environment: statusData.environment,
          hasProcessEnv: statusData.hasProcessEnv,
          nextConfigWorking: statusData.nextConfigWorking,
          environmentVariables: statusData.environmentVariables,
          apiKeyAnalysis: statusData.apiKeyAnalysis
        });

        // Also trigger a background check to update the database
        fetch('/api/cron/check-api-status').catch(err => {
          console.error('Error triggering background check:', err);
        });

        // For backward compatibility, also run the direct OpenRouter check
        const apiResponse = await fetch('/api/test-openrouter');
        const apiData = await apiResponse.json();

        if (apiResponse.ok) {
          setApiStatus(apiData);
        } else {
          setApiStatus(apiData);
        }
      } else {
        setError(statusData.error || 'Failed to check API status');

        // Fallback to direct checks
        const apiResponse = await fetch('/api/test-openrouter');
        const apiData = await apiResponse.json();

        if (apiResponse.ok) {
          setApiStatus(apiData);
        } else {
          setError(apiData.error || 'Failed to check API status');
          setApiStatus(apiData);
        }

        const envResponse = await fetch('/api/env-check');
        const envData = await envResponse.json();

        if (envResponse.ok) {
          setEnvStatus(envData);
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while checking API status');

      // Try to get at least some data
      try {
        const apiResponse = await fetch('/api/test-openrouter');
        const apiData = await apiResponse.json();
        setApiStatus(apiData);
      } catch (e) {
        console.error('Error in fallback API check:', e);
      }
    } finally {
      setLoading(false);
    }
  };

  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  // Function to check if we should update the API status
  const shouldCheckApiStatus = () => {
    // If we haven't checked yet, we should check
    if (!lastChecked) return true;

    // If it's been more than 30 minutes since the last check, we should check again
    const thirtyMinutesAgo = new Date();
    thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);
    return lastChecked < thirtyMinutesAgo;
  };

  useEffect(() => {
    // Check API status when the component mounts
    checkApiStatus();
    setLastChecked(new Date());

    // Set up an interval to check the API status every 2 minutes while the page is open
    const intervalId = setInterval(() => {
      // Only check if it's been more than 30 minutes since the last check
      // This prevents excessive API calls but ensures the status is updated regularly
      if (shouldCheckApiStatus()) {
        console.log('Running periodic API status check...');
        checkApiStatus();
        setLastChecked(new Date());
      } else {
        console.log('Skipping API check - last checked less than 30 minutes ago');
      }
    }, 2 * 60 * 1000); // 2 minutes

    // Clean up the interval when the component unmounts
    return () => clearInterval(intervalId);
  }, [lastChecked]);

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

        {/* Database API Status */}
        <div className={`mb-8 p-6 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} shadow-md`}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">API Status Dashboard</h2>
            <div className="flex items-center">
              <div className="text-sm text-gray-500 mr-2">
                {dbApiStatus.length > 0 && dbApiStatus[0].last_checked && (
                  <span>Last checked: {new Date(dbApiStatus[0].last_checked).toLocaleString()}</span>
                )}
              </div>
              <div className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full flex items-center">
                <span className="mr-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </span>
                Auto-updates while dashboard is open
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center p-8">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
          ) : dbApiStatus.length > 0 ? (
            <div className="space-y-6">
              {/* OpenRouter Status */}
              {dbApiStatus.find(s => s.service_name === 'openrouter') && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className={`p-4 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'} border-b border-gray-200`}>
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium">OpenRouter API</h3>
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        dbApiStatus.find(s => s.service_name === 'openrouter')?.status === 'ok'
                          ? theme === 'dark' ? 'bg-green-800 text-green-200' : 'bg-green-100 text-green-800'
                          : theme === 'dark' ? 'bg-red-800 text-red-200' : 'bg-red-100 text-red-800'
                      }`}>
                        {dbApiStatus.find(s => s.service_name === 'openrouter')?.status === 'ok' ? 'Working' : 'Error'}
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="space-y-4">
                      <p>
                        <span className="font-medium">Status:</span>{' '}
                        {dbApiStatus.find(s => s.service_name === 'openrouter')?.details?.message || 'Unknown'}
                      </p>
                      {dbApiStatus.find(s => s.service_name === 'openrouter')?.details?.analysis && (
                        <div className="space-y-2">
                          <p className="font-medium">API Key Analysis:</p>
                          <div className="ml-4 space-y-1">
                            <p>
                              <span className="font-medium">Original Length:</span>{' '}
                              {dbApiStatus.find(s => s.service_name === 'openrouter')?.details?.analysis?.originalLength} characters
                            </p>
                            <p>
                              <span className="font-medium">Sanitized Length:</span>{' '}
                              {dbApiStatus.find(s => s.service_name === 'openrouter')?.details?.analysis?.sanitizedLength} characters
                            </p>
                            <p>
                              <span className="font-medium">Contains Spaces:</span>{' '}
                              <span className={dbApiStatus.find(s => s.service_name === 'openrouter')?.details?.analysis?.hasSpaces ? 'text-red-500' : 'text-green-500'}>
                                {dbApiStatus.find(s => s.service_name === 'openrouter')?.details?.analysis?.hasSpaces ? 'Yes (Problem)' : 'No'}
                              </span>
                            </p>
                            <p>
                              <span className="font-medium">Contains Newlines:</span>{' '}
                              <span className={dbApiStatus.find(s => s.service_name === 'openrouter')?.details?.analysis?.hasNewlines ? 'text-red-500' : 'text-green-500'}>
                                {dbApiStatus.find(s => s.service_name === 'openrouter')?.details?.analysis?.hasNewlines ? 'Yes (Problem)' : 'No'}
                              </span>
                            </p>
                            <p>
                              <span className="font-medium">Contains Invalid Characters:</span>{' '}
                              <span className={dbApiStatus.find(s => s.service_name === 'openrouter')?.details?.analysis?.hasInvalidChars ? 'text-red-500' : 'text-green-500'}>
                                {dbApiStatus.find(s => s.service_name === 'openrouter')?.details?.analysis?.hasInvalidChars ? 'Yes (Problem)' : 'No'}
                              </span>
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* RapidAPI Status */}
              {dbApiStatus.find(s => s.service_name === 'rapidapi') && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className={`p-4 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'} border-b border-gray-200`}>
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium">RapidAPI (TikTok)</h3>
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        dbApiStatus.find(s => s.service_name === 'rapidapi')?.status === 'ok'
                          ? theme === 'dark' ? 'bg-green-800 text-green-200' : 'bg-green-100 text-green-800'
                          : theme === 'dark' ? 'bg-red-800 text-red-200' : 'bg-red-100 text-red-800'
                      }`}>
                        {dbApiStatus.find(s => s.service_name === 'rapidapi')?.status === 'ok' ? 'Working' : 'Error'}
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    <p>
                      <span className="font-medium">Status:</span>{' '}
                      {dbApiStatus.find(s => s.service_name === 'rapidapi')?.details?.message || 'Unknown'}
                    </p>
                  </div>
                </div>
              )}

              {/* Brevo Status */}
              {dbApiStatus.find(s => s.service_name === 'brevo') && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className={`p-4 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'} border-b border-gray-200`}>
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium">Brevo Email</h3>
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        dbApiStatus.find(s => s.service_name === 'brevo')?.status === 'ok'
                          ? theme === 'dark' ? 'bg-green-800 text-green-200' : 'bg-green-100 text-green-800'
                          : theme === 'dark' ? 'bg-red-800 text-red-200' : 'bg-red-100 text-red-800'
                      }`}>
                        {dbApiStatus.find(s => s.service_name === 'brevo')?.status === 'ok' ? 'Working' : 'Error'}
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    <p>
                      <span className="font-medium">Status:</span>{' '}
                      {dbApiStatus.find(s => s.service_name === 'brevo')?.details?.message || 'Unknown'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-center p-4">No API status information available.</p>
          )}
        </div>

        {/* Live OpenRouter API Status */}
        <div className={`mb-8 p-6 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} shadow-md`}>
          <h2 className="text-xl font-semibold mb-4">Live OpenRouter API Check</h2>

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

            {envStatus.apiKeyAnalysis && (
              <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'} mb-4`}>
                <h3 className="font-medium mb-2">API Key Analysis</h3>
                <div className="space-y-2">
                  <p>
                    <span className="font-medium">Original Length:</span>{' '}
                    {envStatus.apiKeyAnalysis.originalLength} characters
                  </p>
                  <p>
                    <span className="font-medium">Sanitized Length:</span>{' '}
                    {envStatus.apiKeyAnalysis.sanitizedLength} characters
                  </p>
                  <p>
                    <span className="font-medium">Contains Spaces:</span>{' '}
                    <span className={envStatus.apiKeyAnalysis.hasSpaces ? 'text-red-500' : 'text-green-500'}>
                      {envStatus.apiKeyAnalysis.hasSpaces ? 'Yes (Problem)' : 'No'}
                    </span>
                  </p>
                  <p>
                    <span className="font-medium">Contains Newlines:</span>{' '}
                    <span className={envStatus.apiKeyAnalysis.hasNewlines ? 'text-red-500' : 'text-green-500'}>
                      {envStatus.apiKeyAnalysis.hasNewlines ? 'Yes (Problem)' : 'No'}
                    </span>
                  </p>
                  <p>
                    <span className="font-medium">Contains Invalid Characters:</span>{' '}
                    <span className={envStatus.apiKeyAnalysis.hasInvalidChars ? 'text-red-500' : 'text-green-500'}>
                      {envStatus.apiKeyAnalysis.hasInvalidChars ? 'Yes (Problem)' : 'No'}
                    </span>
                  </p>
                  <p>
                    <span className="font-medium">First 5 Characters:</span>{' '}
                    {envStatus.apiKeyAnalysis.firstFiveChars}
                  </p>
                  <p>
                    <span className="font-medium">Last 5 Characters:</span>{' '}
                    {envStatus.apiKeyAnalysis.lastFiveChars}
                  </p>
                </div>
              </div>
            )}

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
