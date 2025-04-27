'use client';

import { useState } from 'react';

export default function TestEdgeAnalysis() {
  const [videoId, setVideoId] = useState('');
  const [userId, setUserId] = useState('test-user');
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch('/api/edge-video-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ videoId, userId, videoUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'An error occurred');
      }

      setResult(data);
      
      // If analysis was successful, update the database
      if (data.success && data.analysis) {
        await updateDatabase(data.videoId, data.analysis);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const updateDatabase = async (videoId: string, analysis: string) => {
    try {
      const response = await fetch('/api/update-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          videoId, 
          analysis,
          updateType: 'direct'
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error updating database');
      }
      
      setResult(prev => ({
        ...prev,
        databaseUpdate: {
          success: true,
          message: 'Database updated successfully',
          data
        }
      }));
    } catch (err: any) {
      setResult(prev => ({
        ...prev,
        databaseUpdate: {
          success: false,
          error: err.message
        }
      }));
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Test Edge Function Video Analysis</h1>
      <p className="mb-4">This page uses the Edge Function runtime which has a 30 second timeout instead of 10 seconds.</p>
      
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
        
        <div className="mb-4">
          <label htmlFor="videoUrl" className="block mb-2">
            Video URL (must be publicly accessible):
          </label>
          <input
            type="text"
            id="videoUrl"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            className="w-full p-2 border rounded"
            placeholder="https://example.com/video.mp4"
            required
          />
        </div>
        
        <div className="mb-4">
          <label htmlFor="userId" className="block mb-2">
            User ID:
          </label>
          <input
            type="text"
            id="userId"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="w-full p-2 border rounded"
            placeholder="Enter user ID"
            required
          />
        </div>
        
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-blue-300"
        >
          {loading ? 'Analyzing...' : 'Analyze Video'}
        </button>
      </form>
      
      {loading && <p className="text-gray-600">Loading... This may take up to 30 seconds.</p>}
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p className="font-bold">Error:</p>
          <p>{error}</p>
        </div>
      )}
      
      {result && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          <p className="font-bold">Result:</p>
          
          {result.databaseUpdate && (
            <div className="mt-2">
              <p className="font-semibold">Database Update:</p>
              <p>{result.databaseUpdate.success ? 'Success!' : 'Failed!'} {result.databaseUpdate.message || result.databaseUpdate.error}</p>
            </div>
          )}
          
          <div className="mt-4">
            <h2 className="text-xl font-semibold mb-2">API Response:</h2>
            <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-96">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
          
          {result.analysis && (
            <div className="mt-4">
              <h2 className="text-xl font-semibold mb-2">Analysis:</h2>
              <div className="bg-white p-4 rounded border">
                {result.analysis}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
