'use client';

import { useState } from 'react';

export default function CheckAnalysisPage() {
  const [videoId, setVideoId] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkAnalysis = async () => {
    if (!videoId) {
      setError('Please enter a video ID');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`/api/get-analysis?videoId=${encodeURIComponent(videoId)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get analysis status');
      }

      setResult(data);
    } catch (error: any) {
      console.error('Error checking analysis:', error);
      setError(error.message || 'An error occurred while checking analysis');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-gray-800 rounded-xl shadow-xl p-8 border border-gray-700">
        <h1 className="text-3xl font-bold mb-6 bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
          Check Video Analysis Status
        </h1>
        
        <p className="text-gray-300 mb-8">
          Enter a video ID to check the current analysis status and result.
        </p>

        <div className="flex gap-4 mb-6">
          <input
            type="text"
            value={videoId}
            onChange={(e) => setVideoId(e.target.value)}
            placeholder="Enter video ID"
            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          
          <button
            onClick={checkAnalysis}
            disabled={loading}
            className={`px-6 py-2 rounded-lg font-medium transition-all ${
              loading
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                Checking...
              </div>
            ) : (
              'Check Status'
            )}
          </button>
        </div>

        {error && (
          <div className="mt-6 p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-300">
            <h3 className="font-semibold mb-2">Error</h3>
            <p>{error}</p>
          </div>
        )}

        {result && (
          <div className="mt-6 p-4 bg-gray-700 border border-gray-600 rounded-lg">
            <h3 className="font-semibold mb-2 text-indigo-300">Analysis Status</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <p className="text-gray-400 text-sm">Video ID:</p>
                <p className="text-white">{result.videoId}</p>
              </div>
              
              <div>
                <p className="text-gray-400 text-sm">Status:</p>
                <p className={`font-medium ${
                  result.status === 'in_progress' 
                    ? 'text-yellow-400' 
                    : 'text-green-400'
                }`}>
                  {result.status === 'in_progress' ? 'In Progress' : 'Completed'}
                </p>
              </div>
              
              {result.lastAnalyzedAt && (
                <div>
                  <p className="text-gray-400 text-sm">Last Analyzed:</p>
                  <p className="text-white">{new Date(result.lastAnalyzedAt).toLocaleString()}</p>
                </div>
              )}
              
              <div>
                <p className="text-gray-400 text-sm">Summary:</p>
                <div className="mt-2 p-4 bg-gray-800 rounded border border-gray-700 max-h-60 overflow-y-auto">
                  <p className="text-white whitespace-pre-wrap">{result.summary}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
