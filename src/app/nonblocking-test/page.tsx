'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';

export default function NonblockingTestPage() {
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState<Record<string, boolean>>({});
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  // Fetch videos on page load
  useEffect(() => {
    fetchVideos();

    // Set up a refresh interval to check for updates every 10 seconds
    const interval = setInterval(fetchVideos, 10000);
    setRefreshInterval(interval);

    // Clean up the interval when the component unmounts
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, []);

  // Function to fetch videos
  const fetchVideos = async () => {
    try {
      const { data, error } = await supabase
        .from('tiktok_videos')
        .select('id, video_url, download_url, summary, caption, last_analyzed_at')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching videos:', error);
      } else {
        setVideos(data || []);
      }
    } catch (error) {
      console.error('Error in fetchVideos:', error);
    } finally {
      setLoading(false);
    }
  };

  // Function to analyze a video using the non-blocking approach
  const analyzeVideo = async (videoId: string) => {
    if (!videoId) return;

    setAnalyzing(prev => ({ ...prev, [videoId]: true }));

    try {
      // Call the analyze-video-nonblocking endpoint
      const response = await fetch('/api/analyze-video-nonblocking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ videoId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start video analysis');
      }

      // Refresh the videos list to show the "Analysis in progress..." status
      fetchVideos();

      // Set up a polling mechanism to check for updates
      const checkInterval = setInterval(async () => {
        const { data: videoData, error } = await supabase
          .from('tiktok_videos')
          .select('summary')
          .eq('id', videoId)
          .single();

        if (!error && videoData && videoData.summary !== 'Analysis in progress...') {
          clearInterval(checkInterval);
          setAnalyzing(prev => ({ ...prev, [videoId]: false }));
          fetchVideos();
        }
      }, 5000); // Check every 5 seconds

      // Stop polling after 2 minutes if no result
      setTimeout(() => {
        clearInterval(checkInterval);
        setAnalyzing(prev => ({ ...prev, [videoId]: false }));
      }, 120000);
    } catch (error: any) {
      console.error('Error analyzing video:', error);
      setAnalyzing(prev => ({ ...prev, [videoId]: false }));
    }
  };

  // Function to format the last analyzed time
  const formatLastAnalyzed = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Non-blocking Video Analysis Test</h1>
        <p className="text-gray-300 mb-8">
          This page uses a non-blocking approach that starts the analysis in the background and returns immediately to avoid timeouts.
          The page automatically refreshes every 10 seconds to show the latest analysis results.
        </p>
        
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
          </div>
        ) : videos.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-6 text-center">
            <p>No videos found. Please generate some trends first.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {videos.map((video) => (
              <div 
                key={video.id} 
                className={`bg-gray-800 rounded-lg p-6 border ${
                  analyzing[video.id] ? 'border-yellow-500' : 
                  video.summary === 'Analysis in progress...' ? 'border-blue-500' : 
                  video.summary && video.summary.startsWith('Error') ? 'border-red-500' : 
                  video.summary ? 'border-green-500' : 'border-gray-700'
                }`}
              >
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="w-full md:w-1/3">
                    <h3 className="font-semibold mb-2 text-lg">Video Details</h3>
                    <p className="text-gray-400 text-sm mb-1">ID: {video.id}</p>
                    <p className="text-gray-400 text-sm mb-1">Caption: {video.caption}</p>
                    <p className="text-gray-400 text-sm mb-1">
                      URL Available: {video.download_url ? 'Yes' : 'No'}
                    </p>
                    <p className="text-gray-400 text-sm mb-4">
                      Last Analyzed: {formatLastAnalyzed(video.last_analyzed_at)}
                    </p>
                    
                    <button
                      onClick={() => analyzeVideo(video.id)}
                      disabled={analyzing[video.id] || video.summary === 'Analysis in progress...'}
                      className={`w-full py-2 px-4 rounded font-medium ${
                        analyzing[video.id] || video.summary === 'Analysis in progress...'
                          ? 'bg-gray-600 cursor-not-allowed'
                          : 'bg-indigo-600 hover:bg-indigo-700'
                      }`}
                    >
                      {analyzing[video.id] || video.summary === 'Analysis in progress...' ? (
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                          Analysis in Progress...
                        </div>
                      ) : (
                        'Analyze Video'
                      )}
                    </button>
                  </div>
                  
                  <div className="w-full md:w-2/3">
                    <h3 className="font-semibold mb-2 text-lg">Analysis Result</h3>
                    {video.summary ? (
                      <div className={`rounded p-4 max-h-60 overflow-y-auto ${
                        video.summary === 'Analysis in progress...' ? 'bg-blue-900/30 text-blue-300' :
                        video.summary.startsWith('Error') ? 'bg-red-900/30 text-red-300' :
                        'bg-gray-900 text-gray-300'
                      }`}>
                        <p className="whitespace-pre-wrap">{video.summary}</p>
                      </div>
                    ) : (
                      <div className="bg-gray-900 rounded p-4 text-gray-500 italic">
                        No analysis available. Click "Analyze Video" to generate one.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
