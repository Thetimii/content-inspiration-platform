'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';

export default function SimpleTestPage() {
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);

  // Fetch videos on page load
  useEffect(() => {
    async function fetchVideos() {
      try {
        const { data, error } = await supabase
          .from('tiktok_videos')
          .select('id, video_url, download_url, summary, caption')
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
    }

    fetchVideos();
  }, []);

  // Function to analyze a video
  const analyzeVideo = async (videoId: string) => {
    if (!videoId) return;

    setAnalyzing(true);
    setSelectedVideo(videoId);
    setAnalysisResult(null);

    try {
      const response = await fetch('/api/simple-video-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ videoId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze video');
      }

      setAnalysisResult(data.analysis);

      // Refresh the video list to show the updated summary
      const { data: updatedVideos, error } = await supabase
        .from('tiktok_videos')
        .select('id, video_url, download_url, summary, caption')
        .order('created_at', { ascending: false })
        .limit(10);

      if (!error) {
        setVideos(updatedVideos || []);
      }
    } catch (error: any) {
      console.error('Error analyzing video:', error);
      setAnalysisResult(`Error: ${error.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Simple Video Analysis Test</h1>
        
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
                  selectedVideo === video.id ? 'border-indigo-500' : 'border-gray-700'
                }`}
              >
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="w-full md:w-1/3">
                    <h3 className="font-semibold mb-2 text-lg">Video Details</h3>
                    <p className="text-gray-400 text-sm mb-1">ID: {video.id}</p>
                    <p className="text-gray-400 text-sm mb-1">Caption: {video.caption}</p>
                    <p className="text-gray-400 text-sm mb-4">
                      URL Available: {video.download_url ? 'Yes' : 'No'}
                    </p>
                    
                    <button
                      onClick={() => analyzeVideo(video.id)}
                      disabled={analyzing && selectedVideo === video.id}
                      className={`w-full py-2 px-4 rounded font-medium ${
                        analyzing && selectedVideo === video.id
                          ? 'bg-gray-600 cursor-not-allowed'
                          : 'bg-indigo-600 hover:bg-indigo-700'
                      }`}
                    >
                      {analyzing && selectedVideo === video.id ? (
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                          Analyzing...
                        </div>
                      ) : (
                        'Analyze Video'
                      )}
                    </button>
                  </div>
                  
                  <div className="w-full md:w-2/3">
                    <h3 className="font-semibold mb-2 text-lg">Analysis Result</h3>
                    {video.summary ? (
                      <div className="bg-gray-900 rounded p-4 max-h-60 overflow-y-auto">
                        <p className="text-gray-300 whitespace-pre-wrap">{video.summary}</p>
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
