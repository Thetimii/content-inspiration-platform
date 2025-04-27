'use client';

import { useState } from 'react';

export default function TestDashScope() {
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [useEdge, setUseEdge] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      // Use the Edge Function endpoint if selected
      const endpoint = useEdge ? '/api/test-dashscope-edge' : '/api/test-dashscope';
      console.log(`Using endpoint: ${endpoint}`);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ videoUrl }),
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

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Test DashScope API</h1>

      <form onSubmit={handleSubmit} className="mb-6">
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
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={useEdge}
              onChange={(e) => setUseEdge(e.target.checked)}
              className="mr-2"
            />
            Use Edge Function (30 second timeout instead of 10 seconds)
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-blue-300"
        >
          {loading ? 'Testing...' : 'Test API'}
        </button>
      </form>

      {loading && <p className="text-gray-600">Loading... This may take up to a minute.</p>}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p className="font-bold">Error:</p>
          <p>{error}</p>
        </div>
      )}

      {result && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          <p className="font-bold">Success!</p>
          <div className="mt-4">
            <h2 className="text-xl font-semibold mb-2">API Response:</h2>
            <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-96">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>

          {result.response?.output && (
            <div className="mt-4">
              <h2 className="text-xl font-semibold mb-2">Analysis Output:</h2>
              <div className="bg-white p-4 rounded border">
                {result.response.output}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
