'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import ReactMarkdown from 'react-markdown';
import { motion } from 'framer-motion';
import { FiArrowLeft, FiStar, FiClock, FiVideo, FiDownload } from 'react-icons/fi';

export default function RecommendationDetail({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [recommendation, setRecommendation] = useState<any>(null);
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/auth/login');
          return;
        }

        fetchRecommendation(params.id);
      } catch (error) {
        console.error('Error checking user:', error);
        router.push('/auth/login');
      }
    };

    checkUser();
  }, [router, params.id]);

  const fetchRecommendation = async (id: string) => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('recommendations')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        throw error;
      }

      setRecommendation(data);

      // Fetch related videos if video_ids exists
      if (data.video_ids && data.video_ids.length > 0) {
        const { data: videosData, error: videosError } = await supabase
          .from('tiktok_videos')
          .select('*, trend_queries(query)')
          .in('id', data.video_ids)
          .order('likes', { ascending: false });

        if (!videosError) {
          setVideos(videosData || []);
        }
      }
    } catch (error: any) {
      console.error('Error fetching recommendation:', error);
      setError(error.message || 'Failed to load recommendation');
    } finally {
      setLoading(false);
    }
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: 'spring', stiffness: 100 }
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading recommendation...</p>
        </div>
      </div>
    );
  }

  if (error || !recommendation) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
            <p className="text-red-600">{error || 'Recommendation not found'}</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          className="flex justify-between items-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <FiStar className="mr-2 text-indigo-600" />
            Content Recommendation
          </h1>
          <motion.button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <FiArrowLeft className="mr-2" />
            Back to Dashboard
          </motion.button>
        </motion.div>

        {/* Recommendation date */}
        <motion.div
          className="mb-6 text-gray-500 flex items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <FiClock className="mr-2" />
          Generated on {new Date(recommendation.created_at).toLocaleDateString()} at {new Date(recommendation.created_at).toLocaleTimeString()}
        </motion.div>

        {/* Content */}
        <motion.div
          className="bg-white shadow rounded-lg overflow-hidden mb-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <div className="p-6">
            <motion.div className="prose max-w-none" variants={itemVariants}>
              <ReactMarkdown>
                {recommendation.combined_summary}
              </ReactMarkdown>
            </motion.div>
          </div>
        </motion.div>

        {/* Related Videos */}
        {videos.length > 0 && (
          <motion.div
            className="bg-white shadow rounded-lg p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h2 className="text-xl font-semibold mb-6 flex items-center">
              <FiVideo className="mr-2 text-indigo-600" />
              Videos Used for This Recommendation
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {videos.slice(0, 6).map((video) => (
                <motion.div
                  key={video.id}
                  className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow duration-300"
                  whileHover={{ y: -5, transition: { duration: 0.2 } }}
                >
                  <div className="p-4">
                    <p className="font-medium mb-2 line-clamp-2">{video.caption}</p>
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>{video.likes.toLocaleString()} likes</span>
                      <span>{video.views.toLocaleString()} views</span>
                    </div>
                    {video.trend_queries && (
                      <div className="mt-2">
                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded text-xs">
                          #{video.trend_queries.query}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-4 bg-gray-50 border-t border-gray-200">
                    <div className="flex justify-between">
                      <a
                        href={video.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:text-indigo-800 text-sm font-medium flex items-center"
                      >
                        View on TikTok <span className="ml-1">→</span>
                      </a>
                      {video.download_url && (
                        <a
                          href={video.download_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-600 hover:text-green-800 text-sm font-medium flex items-center"
                        >
                          <FiDownload className="mr-1" /> Download
                        </a>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
