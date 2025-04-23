'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { motion } from 'framer-motion';
import { FiArrowLeft, FiVideo, FiHeart, FiEye, FiHash, FiExternalLink, FiDownload } from 'react-icons/fi';

export default function VideoAnalysisPage() {
  const router = useRouter();
  const params = useParams();
  const videoId = params.id as string;

  const [video, setVideo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    const fetchVideo = async () => {
      try {
        setLoading(true);

        // Fetch video data
        const { data, error } = await supabase
          .from('tiktok_videos')
          .select('*, trend_queries(query)')
          .eq('id', videoId)
          .single();

        if (error) {
          throw error;
        }

        setVideo(data);
      } catch (error: any) {
        console.error('Error fetching video:', error);
        setError(error.message || 'Failed to load video');
      } finally {
        setLoading(false);
      }
    };

    if (videoId) {
      fetchVideo();
    }
  }, [videoId]);

  const handleAnalyzeVideo = async () => {
    if (!video || !video.download_url) {
      setError('No download URL available for this video');
      return;
    }

    try {
      setAnalyzing(true);

      // Call the new analyze-video-openrouter API
      const response = await fetch('/api/analyze-video-openrouter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId: video.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze video');
      }

      const data = await response.json();
      setVideo(data.video);
    } catch (error: any) {
      console.error('Error analyzing video with OpenRouter:', error);
      setError(error.message || 'Failed to analyze video');
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading video analysis...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">Error</div>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-500 text-xl mb-4">Video Not Found</div>
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          className="flex justify-between items-center mb-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <FiVideo className="mr-2 text-indigo-600" />
            Video Analysis
          </h1>
          <motion.button
            onClick={() => router.back()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <FiArrowLeft className="mr-2" />
            Back to Dashboard
          </motion.button>
        </motion.div>

        {/* Video Info */}
        <motion.div
          className="bg-white shadow rounded-lg p-6 mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="flex flex-col md:flex-row md:items-start gap-6">
            <div className="w-full md:w-1/3">
              <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center mb-4">
                <motion.a
                  href={video.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:text-indigo-800 text-center p-4 flex flex-col items-center"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <FiExternalLink className="h-12 w-12 mx-auto mb-2" />
                  <span>Watch on TikTok</span>
                </motion.a>
              </div>

              {/* Download button */}
              {video.download_url && (
                <div className="mb-4">
                  <motion.a
                    href={video.download_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center justify-center"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <FiDownload className="mr-2" />
                    <span>Download Video</span>
                  </motion.a>
                </div>
              )}

              <div className="text-sm text-gray-500 space-y-2">
                <p className="flex items-center">
                  <FiHash className="mr-2 text-indigo-500" />
                  <span className="font-medium mr-1">Hashtag:</span> {video.trend_queries?.query}
                </p>
                <p className="flex items-center">
                  <FiHeart className="mr-2 text-pink-500" />
                  <span className="font-medium mr-1">Likes:</span> {video.likes.toLocaleString()}
                </p>
                <p className="flex items-center">
                  <FiEye className="mr-2 text-blue-500" />
                  <span className="font-medium mr-1">Views:</span> {video.views.toLocaleString()}
                </p>
                {video.downloads > 0 && (
                  <p className="flex items-center">
                    <span className="font-medium mr-1">Downloads:</span> {video.downloads.toLocaleString()}
                  </p>
                )}
              </div>

              {video.hashtags && video.hashtags.length > 0 && (
                <div className="mt-4">
                  <p className="font-medium text-sm mb-2">Video Hashtags:</p>
                  <div className="flex flex-wrap gap-1">
                    {video.hashtags.map((tag: string, index: number) => (
                      <span
                        key={index}
                        className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="w-full md:w-2/3">
              <h2 className="text-xl font-semibold mb-2">
                {video.caption || 'Untitled Video'}
              </h2>

              {!video.summary ? (
                <div className="mt-4">
                  <p className="text-gray-500 mb-4">This video hasn't been analyzed yet.</p>
                  <motion.button
                    onClick={handleAnalyzeVideo}
                    disabled={analyzing}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-indigo-300 flex items-center"
                    whileHover={analyzing ? {} : { scale: 1.05 }}
                    whileTap={analyzing ? {} : { scale: 0.95 }}
                  >
                    {analyzing ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          className="mr-2"
                        >
                          <FiVideo />
                        </motion.div>
                        <span>Analyzing...</span>
                      </>
                    ) : (
                      <>
                        <FiVideo className="mr-2" />
                        <span>Analyze Now</span>
                      </>
                    )}
                  </motion.button>
                </div>
              ) : (
                <div className="mt-4">
                  <h3 className="font-medium text-lg mb-2">AI Analysis</h3>
                  <p className="text-gray-700 whitespace-pre-line">{video.summary}</p>

                  {video.transcript && (
                    <div className="mt-6">
                      <h3 className="font-medium text-lg mb-2">Transcript</h3>
                      <div className="bg-gray-50 p-4 rounded-md text-sm text-gray-700 max-h-60 overflow-y-auto">
                        <p className="whitespace-pre-line">{video.transcript}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
