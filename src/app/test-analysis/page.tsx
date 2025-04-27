'use client';

import { useState } from 'react';

export default function TestAnalysis() {
  const [videoId, setVideoId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch('/api/check-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ videoId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'An error occurred');
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartAnalysis = async () => {
    if (!videoId) return;
    
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch('/api/direct-video-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ videoId, userId: 'test-user' }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'An error occurred');
      }

      setResult({
        message: 'Analysis started',
        data
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Test Video Analysis</h1>
      
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="mb-4">
          <label htmlFor="videoId" className="block mb-2">
            Video ID:
          </label>
          <input
            type="text"
            id="videoId"
            value={videoId}
            onChange={(e) => setVideoId(e.target.value)}
            className="w-full p-2 border rounded"
            placeholder="Enter video ID"
            required
          />
        </div>
        
        <div className="flex space-x-4">
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-blue-300"
          >
            {loading ? 'Checking...' : 'Check Status'}
          </button>
          
          <button
            type="button"
            onClick={handleStartAnalysis}
            disabled={loading || !videoId}
            className="bg-green-500 text-white px-4 py-2 rounded disabled:bg-green-300"
          >
            Start Analysis
          </button>
        </div>
      </form>
      
      {loading && <p className="text-gray-600">Loading...</p>}
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p className="font-bold">Error:</p>
          <p>{error}</p>
        </div>
      )}
      
      {result && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          <p className="font-bold">Result:</p>
          <div className="mt-4">
            <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-96">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
          
          {result.frame_analysis && (
            <div className="mt-4">
              <h2 className="text-xl font-semibold mb-2">Analysis:</h2>
              <div className="bg-white p-4 rounded border">
                {result.frame_analysis}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
