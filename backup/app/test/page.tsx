'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

export default function TestPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const runTest = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/test-analysis');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'An error occurred during testing');
      }

      setResult(data);
    } catch (error: any) {
      console.error('Error running test:', error);
      setError(error.message || 'An error occurred during testing');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-gray-800 rounded-xl shadow-xl p-8 border border-gray-700">
        <h1 className="text-3xl font-bold mb-6 bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
          Video Analysis Test
        </h1>
        
        <p className="text-gray-300 mb-8">
          This page allows you to test the video analysis functionality without registering a new user.
          It will use existing data from the database or create test data if needed.
        </p>

        <motion.button
          onClick={runTest}
          disabled={loading}
          className={`w-full py-3 px-6 rounded-lg font-medium transition-all ${
            loading
              ? 'bg-gray-600 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700'
          }`}
          whileHover={{ scale: loading ? 1 : 1.02 }}
          whileTap={{ scale: loading ? 1 : 0.98 }}
        >
          {loading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div>
              Running Test...
            </div>
          ) : (
            'Run Test'
          )}
        </motion.button>

        {error && (
          <div className="mt-6 p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-300">
            <h3 className="font-semibold mb-2">Error</h3>
            <p>{error}</p>
          </div>
        )}

        {result && (
          <div className="mt-6 p-4 bg-green-900/30 border border-green-800 rounded-lg text-green-300">
            <h3 className="font-semibold mb-2">Test Result</h3>
            <pre className="whitespace-pre-wrap text-sm overflow-auto max-h-60">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}

        <div className="mt-8 text-gray-400 text-sm">
          <h3 className="font-semibold mb-2">What this test does:</h3>
          <ol className="list-decimal list-inside space-y-2">
            <li>Finds an existing user in the database</li>
            <li>Checks for existing trend queries and videos</li>
            <li>If none exist, creates test queries and scrapes videos</li>
            <li>Triggers the video analysis process</li>
            <li>Returns the result of the operation</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
