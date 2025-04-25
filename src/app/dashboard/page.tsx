'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { FiUser, FiLogOut, FiTrendingUp, FiStar, FiVideo, FiRefreshCw, FiPlus, FiHeart, FiEye, FiClock, FiHash, FiMail, FiDownload, FiAlertCircle, FiHome, FiCreditCard } from 'react-icons/fi';
import { useTheme } from '@/utils/themeContext';
import EmailPreferences from '@/components/EmailPreferences';
import EditableProfileField from '@/components/EditableProfileField';
import DashboardSidebar from '@/components/DashboardSidebar';
import WelcomeSection from '@/components/WelcomeSection';
import QuickActions from '@/components/QuickActions';
import VideoCard from '@/components/VideoCard';
import VideoCardEnhanced from '@/components/VideoCardEnhanced';
import RecommendationCard from '@/components/RecommendationCard';
import StatisticsCard from '@/components/StatisticsCard';
import SubscriptionStatus from '@/components/SubscriptionStatus';
import ManageSubscriptionButton from '@/components/ManageSubscriptionButton';
import SubscriptionContent from '@/components/SubscriptionContent';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [trendQueries, setTrendQueries] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [collapsedQueries, setCollapsedQueries] = useState<Record<string, boolean>>({}); // Track which queries are collapsed
  const [scrapingQueries, setScrapingQueries] = useState<Record<string, boolean>>({}); // Track which queries are being scraped
  const [analyzingVideos, setAnalyzingVideos] = useState<Record<string, boolean>>({}); // Track which videos are being analyzed
  const [gettingCleanUrls, setGettingCleanUrls] = useState<Record<string, boolean>>({}); // Track which videos are getting clean URLs
  const [generatingRecommendation, setGeneratingRecommendation] = useState<boolean>(false); // Track if a recommendation is being generated
  const { theme } = useTheme();
  const [lastUpdateTime, setLastUpdateTime] = useState<string | null>(null);

  // Function to show update success message
  const showUpdateMessage = () => {
    const statusElement = document.getElementById('profile-update-status');
    if (statusElement) {
      statusElement.classList.remove('hidden');
      setTimeout(() => {
        statusElement.classList.add('hidden');
      }, 3000);
    }
  };

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        router.push('/auth/login');
        return;
      }

      // Check for tab parameter in URL
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const tabParam = urlParams.get('tab');
        if (tabParam && ['overview', 'videos', 'recommendations', 'subscription', 'profile', 'email', 'api-status'].includes(tabParam)) {
          setActiveTab(tabParam);

          // Remove the tab parameter from the URL to avoid issues with refreshing
          const newUrl = window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);
        }
      }

      setUser(data.session.user);

      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.session.user.id)
        .single();

      if (profileError) {
        console.error('Error fetching user profile:', profileError);
        setLoading(false);
        return;
      }

      setUserProfile(profileData);

      // Fetch trend queries
      const { data: queriesData, error: queriesError } = await supabase
        .from('trend_queries')
        .select('*')
        .eq('user_id', data.session.user.id)
        .order('created_at', { ascending: false });

      if (!queriesError) {
        setTrendQueries(queriesData || []);
      }

      // Fetch videos
      const { data: videosData, error: videosError } = await supabase
        .from('tiktok_videos')
        .select('*, trend_queries(query)')
        .in(
          'trend_query_id',
          queriesData?.map(q => q.id) || []
        )
        .order('likes', { ascending: false });

      if (!videosError) {
        setVideos(videosData || []);
      }

      // Fetch recommendations
      const { data: recommendationsData, error: recommendationsError } = await supabase
        .from('recommendations')
        .select('*')
        .eq('user_id', data.session.user.id)
        .order('created_at', { ascending: false });

      if (!recommendationsError) {
        setRecommendations(recommendationsData || []);

        // Set last update time from the most recent recommendation
        if (recommendationsData && recommendationsData.length > 0) {
          const latestRec = recommendationsData[0];
          setLastUpdateTime(new Date(latestRec.created_at).toLocaleString());
        }
      }

      setLoading(false);

      // Check if we need to generate trends automatically
      // Only do this if we don't already have recommendations
      const shouldGenerateTrends = await checkIfShouldGenerateTrends(data.session.user.id, queriesData || []);
      const hasRecommendations = recommendationsData && recommendationsData.length > 0;
      const hasRecentQueries = queriesData && queriesData.length > 0 &&
        new Date().getTime() - new Date(queriesData[0].created_at).getTime() < 24 * 60 * 60 * 1000;

      if (shouldGenerateTrends && profileData?.business_description && !hasRecommendations && !hasRecentQueries) {
        console.log('Automatically generating trends...');
        generateTrends(profileData.business_description, data.session.user.id);
      }
    };

    checkUser();
  }, [router]);

  // Function to check if we should generate trends
  const checkIfShouldGenerateTrends = async (userId: string, existingQueries: any[]) => {
    // Case 1: No queries exist yet (first time after onboarding)
    if (existingQueries.length === 0) {
      return true;
    }

    // Case 2: Check if it's been 24 hours since the last generation
    if (existingQueries.length > 0) {
      const latestQuery = existingQueries[0]; // Queries are ordered by created_at desc
      const lastGeneratedTime = new Date(latestQuery.created_at).getTime();
      const currentTime = new Date().getTime();
      const hoursSinceLastGeneration = (currentTime - lastGeneratedTime) / (1000 * 60 * 60);

      // If it's been more than 24 hours, generate new trends
      if (hoursSinceLastGeneration >= 24) {
        return true;
      }
    }

    return false;
  };

  // Function to generate trends
  const generateTrends = async (businessDescription: string, userId: string) => {
    setGenerating(true);

    try {
      console.log('Generating trends with business description:', businessDescription);

      // Use the simplified API endpoint that only generates queries
      const response = await fetch('/api/simple-trending', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businessDescription,
          userId,
        }),
      });

      const responseData = await response.json();
      console.log('Response from simple-trending:', responseData);

      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to generate trending queries');
      }

      // Update the state with new queries
      setTrendQueries(responseData.queries || []);
      console.log('Updated trend queries state with:', responseData.queries);

      // Show a message to the user that the process has started
      // Use a simple alert since toast might not be available in this context
      alert('Trend analysis started! Your trends are being analyzed. This may take a few minutes. You can check the Videos tab for updates.');

      // Refresh the data after a delay to get updated videos and recommendations
      setTimeout(async () => {
        // Fetch videos again
        const { data: videosData } = await supabase
          .from('tiktok_videos')
          .select('*, trend_queries(query)')
          .in(
            'trend_query_id',
            responseData.queries?.map((q: any) => q.id) || []
          )
          .order('likes', { ascending: false });

        if (videosData) {
          setVideos(videosData);
        }

        // Fetch recommendations again
        const { data: recommendationsData } = await supabase
          .from('recommendations')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (recommendationsData) {
          setRecommendations(recommendationsData);
        }

        setGenerating(false);
      }, 5000); // Check after 5 seconds

    } catch (error: any) {
      console.error('Error generating recommendations:', error);
      setGenerating(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
  };

  const handleGenerateTrends = async () => {
    if (!userProfile?.business_description) {
      setError('Please provide a business description in your profile');
      return;
    }

    setError(null);
    setActiveTab('videos');
    generateTrends(userProfile.business_description, user.id);
  };

  // Function to trigger scraping for a specific query
  const triggerScrapeForQuery = async (queryId: string) => {
    try {
      // Mark this query as being scraped
      setScrapingQueries(prev => ({ ...prev, [queryId]: true }));

      console.log(`Triggering scrape for query ID: ${queryId}`);

      const response = await fetch('/api/trigger-scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          queryId,
        }),
      });

      const data = await response.json();
      console.log('Scrape response:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to scrape videos');
      }

      // Refresh the videos data
      const { data: videosData } = await supabase
        .from('tiktok_videos')
        .select('*, trend_queries(query)')
        .eq('trend_query_id', queryId)
        .order('likes', { ascending: false });

      if (videosData) {
        // Update the videos state with the new videos
        setVideos(prev => {
          // Remove any existing videos for this query
          const filteredVideos = prev.filter(v => v.trend_query_id !== queryId);
          // Add the new videos
          return [...filteredVideos, ...videosData];
        });
      }

      // Show a success message
      alert(`Successfully scraped ${data.videos?.length || 0} videos for this query!`);
    } catch (error: any) {
      console.error('Error scraping videos:', error);
      alert(`Error scraping videos: ${error.message}`);
    } finally {
      // Mark this query as no longer being scraped
      setScrapingQueries(prev => ({ ...prev, [queryId]: false }));
    }
  };

  // Function to trigger scraping for all queries
  const triggerScrapeForAllQueries = async () => {
    try {
      // Get queries that don't have videos yet
      const queriesToScrape = trendQueries.filter(query => {
        // Check if this query has any videos
        return !videos.some(video => video.trend_query_id === query.id);
      });

      if (queriesToScrape.length === 0) {
        alert('All queries already have videos!');
        return;
      }

      // Mark all queries as being scraped
      const newScrapingState: Record<string, boolean> = {};
      queriesToScrape.forEach(query => {
        newScrapingState[query.id] = true;
      });
      setScrapingQueries(prev => ({ ...prev, ...newScrapingState }));

      // Process queries one by one
      for (const query of queriesToScrape) {
        try {
          console.log(`Triggering scrape for query ID: ${query.id}`);

          const response = await fetch('/api/trigger-scrape', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: user.id,
              queryId: query.id,
            }),
          });

          const data = await response.json();
          console.log(`Scrape response for query ${query.id}:`, data);

          if (!response.ok) {
            console.error(`Error scraping videos for query ${query.id}:`, data.error);
            continue; // Continue with the next query even if this one fails
          }

          // Refresh the videos data for this query
          const { data: videosData } = await supabase
            .from('tiktok_videos')
            .select('*, trend_queries(query)')
            .eq('trend_query_id', query.id)
            .order('likes', { ascending: false });

          if (videosData) {
            // Update the videos state with the new videos
            setVideos(prev => {
              // Remove any existing videos for this query
              const filteredVideos = prev.filter(v => v.trend_query_id !== query.id);
              // Add the new videos
              return [...filteredVideos, ...videosData];
            });
          }

          // Mark this query as no longer being scraped
          setScrapingQueries(prev => ({ ...prev, [query.id]: false }));
        } catch (error: any) {
          console.error(`Error scraping videos for query ${query.id}:`, error);
          // Mark this query as no longer being scraped
          setScrapingQueries(prev => ({ ...prev, [query.id]: false }));
        }
      }

      // Show a success message
      alert('Finished scraping videos for all queries!');
    } catch (error: any) {
      console.error('Error scraping videos for all queries:', error);
      alert(`Error: ${error.message}`);

      // Reset all scraping states
      setScrapingQueries({});
    }
  };

  // Function to get a clean download URL for a video
  const getCleanUrl = async (videoId: string) => {
    try {
      // Mark this video as getting a clean URL
      setGettingCleanUrls(prev => ({ ...prev, [videoId]: true }));

      console.log(`Getting clean URL for video ID: ${videoId}`);

      const response = await fetch('/api/get-clean-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId,
        }),
      });

      const data = await response.json();
      console.log('Get clean URL response:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get clean URL');
      }

      // Refresh the videos data
      const { data: videosData } = await supabase
        .from('tiktok_videos')
        .select('*, trend_queries(query)')
        .eq('id', videoId)
        .single();

      if (videosData) {
        // Update the videos state with the updated video
        setVideos(prev => {
          // Replace the video with the updated one
          return prev.map(v => v.id === videoId ? videosData : v);
        });
      }

      // Show a success message
      alert(`Clean URL obtained successfully: ${data.download_url}`);
    } catch (error: any) {
      console.error('Error getting clean URL:', error);
      alert(`Error getting clean URL: ${error.message}`);
    } finally {
      // Mark this video as no longer getting a clean URL
      setGettingCleanUrls(prev => ({ ...prev, [videoId]: false }));
    }
  };

  // Function to analyze a single video
  const analyzeVideo = async (videoId: string) => {
    try {
      // Mark this video as being analyzed
      setAnalyzingVideos(prev => ({ ...prev, [videoId]: true }));

      console.log(`Analyzing video ID: ${videoId}`);

      const response = await fetch('/api/video-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          videoId,
        }),
      });

      const data = await response.json();
      console.log('Analysis response:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze video');
      }

      // Refresh the videos data
      const { data: videosData } = await supabase
        .from('tiktok_videos')
        .select('*, trend_queries(query)')
        .eq('id', videoId)
        .single();

      if (videosData) {
        // Update the videos state with the updated video
        setVideos(prev => {
          // Replace the video with the updated one
          return prev.map(v => v.id === videoId ? videosData : v);
        });
      }

      // Show a success message
      alert('Video analyzed successfully!');
    } catch (error: any) {
      console.error('Error analyzing video:', error);
      alert(`Error analyzing video: ${error.message}`);
    } finally {
      // Mark this video as no longer being analyzed
      setAnalyzingVideos(prev => ({ ...prev, [videoId]: false }));
    }
  };

  // Function to analyze all videos for a query
  const analyzeAllVideosForQuery = async (queryId: string) => {
    try {
      // Get all videos for this query
      const queryVideos = videos.filter(video => video.trend_query_id === queryId);

      if (queryVideos.length === 0) {
        alert('No videos found for this query!');
        return;
      }

      // Mark all videos as being analyzed
      const newAnalyzingState: Record<string, boolean> = {};
      queryVideos.forEach(video => {
        newAnalyzingState[video.id] = true;
      });
      setAnalyzingVideos(prev => ({ ...prev, ...newAnalyzingState }));

      // Process videos one by one
      for (const video of queryVideos) {
        try {
          // Skip videos that already have analysis
          if (video.frame_analysis) {
            console.log(`Video ${video.id} already has analysis, skipping`);
            setAnalyzingVideos(prev => ({ ...prev, [video.id]: false }));
            continue;
          }

          console.log(`Analyzing video ID: ${video.id}`);

          const response = await fetch('/api/video-analysis', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: user.id,
              videoId: video.id,
            }),
          });

          const data = await response.json();
          console.log(`Analysis response for video ${video.id}:`, data);

          if (!response.ok) {
            console.error(`Error analyzing video ${video.id}:`, data.error);
            continue; // Continue with the next video even if this one fails
          }

          // Refresh the videos data for this video
          const { data: videoData } = await supabase
            .from('tiktok_videos')
            .select('*, trend_queries(query)')
            .eq('id', video.id)
            .single();

          if (videoData) {
            // Update the videos state with the updated video
            setVideos(prev => {
              // Replace the video with the updated one
              return prev.map(v => v.id === video.id ? videoData : v);
            });
          }

          // Mark this video as no longer being analyzed
          setAnalyzingVideos(prev => ({ ...prev, [video.id]: false }));
        } catch (error: any) {
          console.error(`Error analyzing video ${video.id}:`, error);
          // Mark this video as no longer being analyzed
          setAnalyzingVideos(prev => ({ ...prev, [video.id]: false }));
        }
      }

      // Show a success message
      alert('Finished analyzing videos for this query!');
    } catch (error: any) {
      console.error('Error analyzing videos for query:', error);
      alert(`Error: ${error.message}`);

      // Reset all analyzing states
      setAnalyzingVideos({});
    }
  };

  // Function to generate a recommendation for a query
  const generateRecommendationForQuery = async (queryId: string) => {
    try {
      // Set generating state
      setGeneratingRecommendation(true);

      console.log(`Generating recommendation for query ID: ${queryId}`);

      const response = await fetch('/api/direct-recommendation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          queryId,
        }),
      });

      const data = await response.json();
      console.log('Recommendation response:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate recommendation');
      }

      // Refresh the recommendations data
      const { data: recommendationsData } = await supabase
        .from('recommendations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (recommendationsData) {
        setRecommendations(recommendationsData);

        // Set last update time from the most recent recommendation
        if (recommendationsData.length > 0) {
          setLastUpdateTime(new Date(recommendationsData[0].created_at).toLocaleString());
        }
      }

      // Show a success message
      alert('Recommendation generated successfully!');

      // Switch to the recommendations tab
      setActiveTab('recommendations');
    } catch (error: any) {
      console.error('Error generating recommendation:', error);
      alert(`Error generating recommendation: ${error.message}`);
    } finally {
      // Reset generating state
      setGeneratingRecommendation(false);
    }
  };

  if (loading) {
    return (
      <div className={`flex min-h-screen items-center justify-center ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-800'}`}>
        <div className="text-center">
          <div className={`animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 ${theme === 'dark' ? 'border-indigo-400' : 'border-indigo-600'} mx-auto`}></div>
          <p className={`mt-4 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}`}>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'} transition-colors duration-300`}>
      {/* Sidebar */}
      <DashboardSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onSignOut={handleSignOut}
        userName={userProfile?.name || user?.email?.split('@')[0]}
        userEmail={user?.email}
      />

      {/* Main content */}
      <div className={`ml-20 md:ml-64 p-6 transition-all duration-300`}>

        {/* Welcome Section */}
        <WelcomeSection
          userName={userProfile?.name || user?.email?.split('@')[0]}
          lastUpdateTime={lastUpdateTime}
          isGenerating={generating}
          onGenerateTrends={() => handleGenerateTrends()}
        />

        {/* Quick Actions - only shown in Overview tab */}
        {activeTab === 'overview' && (
          <QuickActions
            onGenerateTrends={() => handleGenerateTrends()}
            onViewProfile={() => setActiveTab('profile')}
            onViewEmails={() => setActiveTab('email')}
            isGenerating={generating}
            hasRecommendations={recommendations.length > 0}
          />
        )}

        {error && (
          <motion.div
            className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {error}
          </motion.div>
        )}

        {/* Tab content is now controlled by the sidebar */}

        {/* Tab content */}
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {/* Subscription Status */}
              <div className="mb-8">
                <SubscriptionStatus />
              </div>

              {/* Statistics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatisticsCard
                  title="Total Videos Analyzed"
                  value={videos.length}
                  icon={FiVideo}
                  color="indigo"
                />
                <StatisticsCard
                  title="Trending Hashtags"
                  value={trendQueries.length}
                  icon={FiHash}
                  color="emerald"
                />
                <StatisticsCard
                  title="Total Likes"
                  value={videos.reduce((sum, video) => sum + (video.likes || 0), 0).toLocaleString()}
                  icon={FiHeart}
                  color="rose"
                  trend={{
                    value: 12,
                    isPositive: true
                  }}
                />
                <StatisticsCard
                  title="Total Views"
                  value={videos.reduce((sum, video) => sum + (video.views || 0), 0).toLocaleString()}
                  icon={FiEye}
                  color="amber"
                  trend={{
                    value: 8,
                    isPositive: true
                  }}
                />
              </div>

              {/* Recent Recommendations */}
              <div className={`${theme === 'dark' ? 'glass-card-dark' : 'glass-card-light'} p-6 rounded-xl mb-8`}>
                <div className="flex justify-between items-center mb-6">
                  <h2 className={`text-xl font-semibold flex items-center ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                    <FiStar className={`mr-2 ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`} />
                    Latest Recommendations
                  </h2>
                  <motion.button
                    onClick={() => setActiveTab('recommendations')}
                    className={`text-sm flex items-center ${theme === 'dark' ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-800'}`}
                    whileHover={{ x: 5 }}
                  >
                    View All <span className="ml-1">→</span>
                  </motion.button>
                </div>

                {recommendations.length > 0 ? (
                  <div className="space-y-6">
                    {recommendations.slice(0, 2).map(recommendation => (
                      <RecommendationCard
                        key={recommendation.id}
                        recommendation={recommendation}
                        onViewFull={(id) => router.push(`/recommendations/${id}`)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className={`text-center py-8 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                    <p>No recommendations yet. They will appear here after trend analysis is complete.</p>
                  </div>
                )}
              </div>

              {/* Recent Videos */}
              <div className={`${theme === 'dark' ? 'glass-card-dark' : 'glass-card-light'} p-6 rounded-xl mb-8`}>
                <div className="flex justify-between items-center mb-6">
                  <h2 className={`text-xl font-semibold flex items-center ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                    <FiVideo className={`mr-2 ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`} />
                    Recent Trending Videos
                  </h2>
                  <motion.button
                    onClick={() => setActiveTab('videos')}
                    className={`text-sm flex items-center ${theme === 'dark' ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-800'}`}
                    whileHover={{ x: 5 }}
                  >
                    View All <span className="ml-1">→</span>
                  </motion.button>
                </div>

                {videos.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {videos.slice(0, 6).map(video => (
                      <VideoCardEnhanced
                        key={video.id}
                        video={video}
                        onGetCleanUrl={getCleanUrl}
                        isGettingCleanUrl={gettingCleanUrls[video.id]}
                      />
                    ))}
                  </div>
                ) : (
                  <div className={`text-center py-8 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                    <p>No videos yet. They will appear here after trend analysis is complete.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
          {activeTab === 'videos' && (
            <motion.div
              key="videos"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div className={`${theme === 'dark' ? 'glass-card-dark' : 'glass-card-light'} p-6 rounded-xl mb-8`}>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold flex items-center">
                    <FiTrendingUp className="mr-2 text-indigo-600" />
                    Top Trending Videos
                  </h2>

                  {trendQueries.length > 0 && (
                    <button
                      onClick={() => triggerScrapeForAllQueries()}
                      disabled={Object.values(scrapingQueries).some(Boolean)}
                      className={`px-3 py-1.5 text-sm rounded-md ${
                        Object.values(scrapingQueries).some(Boolean)
                          ? `${theme === 'dark' ? 'bg-indigo-900 text-indigo-300' : 'bg-indigo-300 text-indigo-700'} cursor-not-allowed`
                          : `${theme === 'dark' ? 'bg-indigo-700 hover:bg-indigo-600 text-white' : 'bg-indigo-500 hover:bg-indigo-600 text-white'}`
                      }`}
                    >
                      <span className="flex items-center">
                        {Object.values(scrapingQueries).some(Boolean) ? (
                          <>
                            <div className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin mr-2"></div>
                            Scraping...
                          </>
                        ) : (
                          <>
                            <FiRefreshCw className="mr-2" />
                            Scrape All Queries
                          </>
                        )}
                      </span>
                    </button>
                  )}
                </div>

                {generating ? (
                  <div className="animate-pulse">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {[...Array(6)].map((_, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                          <div className="p-4">
                            <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                            <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                            <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                            <div className="flex justify-between mb-2">
                              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                            </div>
                          </div>
                          <div className="p-4 bg-gray-50 border-t border-gray-200">
                            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : videos.length > 0 ? (
                  <div className="space-y-8">
                    {/* Group videos by trend query */}
                    {trendQueries.map((query) => {
                      // Filter videos for this specific query
                      const queryVideos = videos.filter(video => video.trend_query_id === query.id);

                      if (queryVideos.length === 0) return null;

                      return (
                        <motion.div
                          key={query.id}
                          className="border border-gray-100 rounded-lg overflow-hidden shadow-sm"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          {/* Collapsible header */}
                          <motion.div
                            className={`${theme === 'dark' ? 'bg-indigo-900/30 hover:bg-indigo-800/40' : 'bg-indigo-50 hover:bg-indigo-100'} p-4 cursor-pointer flex items-center justify-between rounded-t-lg`}
                            whileHover={{ y: -2 }}
                            onClick={() => {
                              // Toggle the collapsed state for this query
                              setCollapsedQueries(prev => ({
                                ...prev,
                                [query.id]: !prev[query.id]
                              }));
                            }}
                          >
                            <div className="flex items-center">
                              <h3 className={`text-lg font-medium flex items-center ${theme === 'dark' ? 'text-indigo-300' : 'text-indigo-800'}`}>
                                <FiHash className="mr-2" />
                                {query.query}
                                <span className={`ml-2 text-xs ${theme === 'dark' ? 'bg-indigo-800/50 text-indigo-300' : 'bg-indigo-100 text-indigo-600'} px-2 py-0.5 rounded-full`}>
                                  {queryVideos.length} videos
                                </span>
                              </h3>
                              <div className="flex ml-4 space-x-2">
                                {queryVideos.length === 0 ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation(); // Prevent toggling the collapse
                                      triggerScrapeForQuery(query.id);
                                    }}
                                    disabled={scrapingQueries[query.id]}
                                    className={`px-2 py-1 text-xs rounded-md ${
                                      scrapingQueries[query.id]
                                        ? `${theme === 'dark' ? 'bg-indigo-900 text-indigo-300' : 'bg-indigo-300 text-indigo-700'} cursor-not-allowed`
                                        : `${theme === 'dark' ? 'bg-indigo-700 hover:bg-indigo-600 text-white' : 'bg-indigo-500 hover:bg-indigo-600 text-white'}`
                                    }`}
                                  >
                                    <span className="flex items-center">
                                      {scrapingQueries[query.id] ? (
                                        <>
                                          <div className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin mr-1"></div>
                                          Scraping...
                                        </>
                                      ) : (
                                        <>
                                          <FiRefreshCw className="mr-1" />
                                          Scrape Videos
                                        </>
                                      )}
                                    </span>
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation(); // Prevent toggling the collapse
                                        analyzeAllVideosForQuery(query.id);
                                      }}
                                      disabled={Object.keys(analyzingVideos).some(id =>
                                        queryVideos.some(v => v.id === id && analyzingVideos[id])
                                      )}
                                      className={`px-2 py-1 text-xs rounded-md ${
                                        Object.keys(analyzingVideos).some(id =>
                                          queryVideos.some(v => v.id === id && analyzingVideos[id])
                                        )
                                          ? `${theme === 'dark' ? 'bg-emerald-900 text-emerald-300' : 'bg-emerald-300 text-emerald-700'} cursor-not-allowed`
                                          : `${theme === 'dark' ? 'bg-emerald-700 hover:bg-emerald-600 text-white' : 'bg-emerald-500 hover:bg-emerald-600 text-white'}`
                                      }`}
                                    >
                                      <span className="flex items-center">
                                        {Object.keys(analyzingVideos).some(id =>
                                          queryVideos.some(v => v.id === id && analyzingVideos[id])
                                        ) ? (
                                          <>
                                            <div className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin mr-1"></div>
                                            Analyzing...
                                          </>
                                        ) : (
                                          <>
                                            <FiRefreshCw className="mr-1" />
                                            Analyze Videos
                                          </>
                                        )}
                                      </span>
                                    </button>

                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation(); // Prevent toggling the collapse
                                        generateRecommendationForQuery(query.id);
                                      }}
                                      disabled={generatingRecommendation}
                                      className={`px-2 py-1 text-xs rounded-md ${
                                        generatingRecommendation
                                          ? `${theme === 'dark' ? 'bg-amber-900 text-amber-300' : 'bg-amber-300 text-amber-700'} cursor-not-allowed`
                                          : `${theme === 'dark' ? 'bg-amber-700 hover:bg-amber-600 text-white' : 'bg-amber-500 hover:bg-amber-600 text-white'}`
                                      }`}
                                    >
                                      <span className="flex items-center">
                                        {generatingRecommendation ? (
                                          <>
                                            <div className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin mr-1"></div>
                                            Generating...
                                          </>
                                        ) : (
                                          <>
                                            <FiStar className="mr-1" />
                                            Generate Recommendation
                                          </>
                                        )}
                                      </span>
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                            <motion.div
                              className={theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}
                              animate={{ rotate: collapsedQueries[query.id] ? 180 : 0 }}
                              transition={{ duration: 0.3 }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </motion.div>
                          </motion.div>

                          {/* Collapsible content */}
                          <div className={`p-4 ${theme === 'dark' ? 'bg-gray-800/50' : 'bg-white'} rounded-b-lg ${collapsedQueries[query.id] ? 'hidden' : ''}`}>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                              {queryVideos.map((video) => (
                                <VideoCardEnhanced
                                  key={video.id}
                                  video={video}
                                  onAnalyze={analyzeVideo}
                                  isAnalyzing={analyzingVideos[video.id]}
                                  onGetCleanUrl={getCleanUrl}
                                  isGettingCleanUrl={gettingCleanUrls[video.id]}
                                />
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : trendQueries.length > 0 ? (
                  <div className="text-center py-8">
                    <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>No videos found for the current trending search terms.</p>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>No trending videos yet. Videos will automatically appear here after trend analysis is complete.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'recommendations' && (
            <motion.div
              key="recommendations"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div className={`${theme === 'dark' ? 'glass-card-dark' : 'glass-card-light'} p-6 rounded-xl mb-8`}>
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <FiStar className="mr-2 text-indigo-600" />
                  Content Recommendations
                </h2>

                {recommendations.length > 0 ? (
                  <div className="space-y-6">
                    {recommendations.map((recommendation) => (
                      <RecommendationCard
                        key={recommendation.id}
                        recommendation={recommendation}
                        onViewFull={(id) => router.push(`/recommendations/${id}`)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      No recommendations yet. Recommendations will automatically appear here after trend analysis is complete.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'email' && (
            <motion.div
              key="email"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="space-y-8">
                {user && <EmailPreferences userId={user.id} />}
              </div>
            </motion.div>
          )}

          {activeTab === 'subscription' && (
            <motion.div
              key="subscription"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="space-y-8">
                <SubscriptionContent />
              </div>
            </motion.div>
          )}

          {activeTab === 'api-status' && (
            <motion.div
              key="api-status"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="space-y-8">
                <iframe
                  src="/dashboard/api-status"
                  className="w-full h-[800px] border-0 rounded-xl shadow-sm"
                  title="API Status"
                />
              </div>
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="space-y-8">
                <div className={`${theme === 'dark' ? 'glass-card-dark' : 'glass-card-light'} p-6 rounded-xl`}>
                  <h2 className="text-xl font-semibold mb-6 flex items-center">
                    <FiUser className="mr-2 text-indigo-600" />
                    Your Profile Details
                  </h2>

                  <div className="space-y-6">
                    {/* Profile update status message */}
                    <div id="profile-update-status" className="hidden">
                      <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-green-900/30 text-green-300' : 'bg-green-50 text-green-700'} flex items-center`}>
                        <FiAlertCircle className="mr-2" />
                        <span>Profile updated successfully!</span>
                      </div>
                    </div>

                    <EditableProfileField
                      label="Business Description"
                      value={userProfile?.business_description || ''}
                      onSave={async (newValue) => {
                        const response = await fetch('/api/update-profile', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({
                            field: 'business_description',
                            value: newValue,
                            userId: user.id,
                          }),
                        });

                        if (response.ok) {
                          setUserProfile(prev => ({ ...prev, business_description: newValue }));
                          showUpdateMessage();
                        } else {
                          throw new Error('Failed to update profile');
                        }
                      }}
                    />

                    <EditableProfileField
                      label="Weekly Time Commitment"
                      value={userProfile?.weekly_time_commitment || 0}
                      type="number"
                      onSave={async (newValue) => {
                        const response = await fetch('/api/update-profile', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({
                            field: 'weekly_time_commitment',
                            value: parseInt(newValue) || 0,
                            userId: user.id,
                          }),
                        });

                        if (response.ok) {
                          setUserProfile(prev => ({ ...prev, weekly_time_commitment: parseInt(newValue) || 0 }));
                          showUpdateMessage();
                        } else {
                          throw new Error('Failed to update profile');
                        }
                      }}
                    />

                    <EditableProfileField
                      label="Social Media Experience"
                      value={userProfile?.social_media_experience || 'beginner'}
                      type="select"
                      options={['beginner', 'intermediate', 'advanced', 'expert']}
                      onSave={async (newValue) => {
                        const response = await fetch('/api/update-profile', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({
                            field: 'social_media_experience',
                            value: newValue,
                            userId: user.id,
                          }),
                        });

                        if (response.ok) {
                          setUserProfile(prev => ({ ...prev, social_media_experience: newValue }));
                          showUpdateMessage();
                        } else {
                          throw new Error('Failed to update profile');
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
