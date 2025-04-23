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

  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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
      } catch (error) {
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Error: {error}</p>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Video not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-2xl font-bold">Video Analysis</h1>
        <button onClick={() => router.back()}>Back</button>
        <div className="mt-4">
          <p>Video ID: {videoId}</p>
        </div>
      </div>
    </div>
  );
}
