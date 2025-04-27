import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { FiHeart, FiEye, FiDownload, FiExternalLink, FiInfo, FiX, FiRefreshCw, FiLink, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';
import { useTheme } from '@/utils/themeContext';

interface VideoCardStreamingProps {
  video: {
    id: string;
    caption: string;
    cover_url?: string;
    likes: number;
    views: number;
    video_url?: string;
    download_url?: string;
    summary?: string;
    frame_analysis?: string;
    hashtags?: string[];
    trend_queries?: { query: string };
  };
  userId: string;
  onAnalysisComplete?: (videoId: string, analysis: string) => void;
}

export default function VideoCardStreaming({ video, userId, onAnalysisComplete }: VideoCardStreamingProps) {
  const { theme } = useTheme();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(video.frame_analysis || null);
  const [analysisStatus, setAnalysisStatus] = useState<string>('idle');
  const [streamMessages, setStreamMessages] = useState<any[]>([]);
  const [showDetails, setShowDetails] = useState(false);

  // Check if analysis is already complete
  const isAnalysisComplete = analysis && analysis !== 'Analysis in progress...';
  const isAnalysisFailed = analysis && analysis.startsWith('Analysis failed:');

  // Start polling for analysis status
  const startPollingAnalysis = async () => {
    try {
      setIsAnalyzing(true);
      setAnalysisStatus('starting');
      setStreamMessages([]);

      // Add initial message
      setStreamMessages(prev => [...prev, {
        type: 'progress',
        message: 'Starting analysis...',
        timestamp: new Date().toISOString(),
        attempts: 1
      }]);

      // Start polling
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes (5 seconds * 60)
      const pollInterval = 5000; // 5 seconds

      const checkStatus = async () => {
        attempts++;

        try {
          const response = await fetch('/api/check-analysis', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              videoId: video.id
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to check analysis status');
          }

          const data = await response.json();

          // Add message to stream
          setStreamMessages(prev => [...prev, {
            type: 'progress',
            message: `Checking analysis status (attempt ${attempts})...`,
            timestamp: new Date().toISOString(),
            attempts
          }]);

          // Check if analysis is complete
          if (data.isAnalysisComplete && !data.isAnalysisFailed) {
            setAnalysis(data.frame_analysis);
            setAnalysisStatus('complete');
            setIsAnalyzing(false);

            setStreamMessages(prev => [...prev, {
              type: 'complete',
              message: 'Analysis complete!',
              timestamp: new Date().toISOString()
            }]);

            if (onAnalysisComplete) {
              onAnalysisComplete(video.id, data.frame_analysis);
            }

            console.log('Analysis complete!');
            return;
          }

          // Check if analysis failed
          if (data.isAnalysisFailed || data.isAnalysisStuck) {
            setAnalysis(data.frame_analysis);
            setAnalysisStatus('failed');
            setIsAnalyzing(false);

            setStreamMessages(prev => [...prev, {
              type: 'failed',
              message: data.frame_analysis || 'Analysis failed',
              timestamp: new Date().toISOString()
            }]);

            console.error('Analysis failed:', data.frame_analysis);
            return;
          }

          // If we've reached the maximum number of attempts, consider it timed out
          if (attempts >= maxAttempts) {
            setAnalysisStatus('timeout');
            setIsAnalyzing(false);

            setStreamMessages(prev => [...prev, {
              type: 'timeout',
              message: 'Analysis timed out after 5 minutes',
              timestamp: new Date().toISOString()
            }]);

            console.error('Analysis timed out');
            return;
          }

          // Continue polling
          setTimeout(checkStatus, pollInterval);
        } catch (error: any) {
          console.error('Error checking analysis status:', error);

          // If there's an error, we'll try again unless we've reached the maximum number of attempts
          if (attempts >= maxAttempts) {
            setAnalysisStatus('error');
            setIsAnalyzing(false);

            setStreamMessages(prev => [...prev, {
              type: 'error',
              message: `Error: ${error.message || 'Failed to check analysis status'}`,
              timestamp: new Date().toISOString()
            }]);

            console.error(`Error: ${error.message || 'Failed to check analysis status'}`);
            return;
          }

          // Continue polling despite the error
          setTimeout(checkStatus, pollInterval);
        }
      };

      // Start checking status
      setTimeout(checkStatus, 2000); // Wait 2 seconds before first check
    } catch (error: any) {
      console.error('Error starting analysis polling:', error);
      setAnalysisStatus('error');
      setIsAnalyzing(false);
      console.error(`Error: ${error.message || 'Failed to analyze video'}`);
    }
  };

  // Analyze the video
  const analyzeVideo = async () => {
    try {
      setIsAnalyzing(true);
      setAnalysisStatus('starting');

      // First, start the analysis process using the direct-video-analysis API
      const response = await fetch('/api/direct-video-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          videoId: video.id
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start analysis');
      }

      // Then start polling for results
      startPollingAnalysis();
    } catch (error: any) {
      console.error('Error analyzing video:', error);
      setAnalysisStatus('error');
      setIsAnalyzing(false);
      console.error(`Error: ${error.message || 'Failed to analyze video'}`);
    }
  };

  // Render analysis status
  const renderAnalysisStatus = () => {
    if (isAnalysisComplete && !isAnalysisFailed) {
      return (
        <div className="flex items-center space-x-2 text-green-600">
          <CheckCircle className="h-4 w-4" />
          <span>Analysis complete</span>
        </div>
      );
    } else if (isAnalysisFailed) {
      return (
        <div className="flex items-center space-x-2 text-red-600">
          <XCircle className="h-4 w-4" />
          <span>Analysis failed</span>
        </div>
      );
    } else if (isAnalyzing) {
      return (
        <div className="flex items-center space-x-2 text-blue-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Analyzing video... {streamMessages.length > 0 ? `(${streamMessages.length} updates)` : ''}</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center space-x-2 text-gray-600">
          <Info className="h-4 w-4" />
          <span>Not analyzed yet</span>
        </div>
      );
    }
  };

  return (
    <motion.div
      className={`${
        theme === 'dark' ? 'glass-card-dark' : 'glass-card-light'
      } rounded-xl overflow-hidden h-full flex flex-col`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      layoutId={`video-card-${video.id}`}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video overflow-hidden group">
        {video.cover_url ? (
          <motion.img
            src={video.cover_url}
            alt={video.caption}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            whileHover={{ scale: 1.05 }}
          />
        ) : (
          <div className={`flex items-center justify-center h-full ${
            theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
          }`}>
            <svg
              className={`w-12 h-12 ${theme === 'dark' ? 'text-gray-700' : 'text-gray-300'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}

        {/* Overlay with stats */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
          <div className="flex justify-between items-center text-white">
            <div className="flex items-center space-x-3">
              <span className="flex items-center">
                <FiHeart className="mr-1 text-pink-500" />
                {video.likes.toLocaleString()}
              </span>
              <span className="flex items-center">
                <FiEye className="mr-1 text-blue-400" />
                {video.views.toLocaleString()}
              </span>
            </div>

            <motion.button
              onClick={() => setShowDetails(true)}
              className="p-2 bg-white/20 backdrop-blur-sm rounded-full"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <FiInfo size={16} />
            </motion.button>
          </div>
        </div>

        {/* Analysis status badge */}
        <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs ${
          isAnalysisComplete && !isAnalysisFailed
            ? theme === 'dark' ? 'bg-green-900/70 text-green-300' : 'bg-green-100 text-green-800'
            : isAnalyzing
              ? theme === 'dark' ? 'bg-yellow-900/70 text-yellow-300' : 'bg-yellow-100 text-yellow-800'
              : isAnalysisFailed
                ? theme === 'dark' ? 'bg-red-900/70 text-red-300' : 'bg-red-100 text-red-800'
                : theme === 'dark' ? 'bg-gray-900/70 text-gray-300' : 'bg-gray-100 text-gray-800'
        } backdrop-blur-sm`}>
          {isAnalysisComplete && !isAnalysisFailed
            ? 'Analyzed'
            : isAnalyzing
              ? 'Analyzing...'
              : isAnalysisFailed
                ? 'Failed'
                : 'Not Analyzed'}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col">
        <h3 className={`font-medium mb-2 line-clamp-2 ${
          theme === 'dark' ? 'text-gray-100' : 'text-gray-800'
        }`}>
          {video.caption}
        </h3>

        {/* Hashtags */}
        {video.hashtags && video.hashtags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1 mb-3">
            {video.hashtags.slice(0, 3).map((tag: string, index: number) => (
              <span
                key={index}
                className={`px-2 py-0.5 rounded text-xs ${
                  theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'
                }`}
              >
                #{tag}
              </span>
            ))}
            {video.hashtags.length > 3 && (
              <span className={`px-2 py-0.5 rounded text-xs ${
                theme === 'dark' ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500'
              }`}>
                +{video.hashtags.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Stream Messages */}
        {isAnalyzing && streamMessages.length > 0 && (
          <div className={`mt-2 text-xs ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          } max-h-20 overflow-y-auto`}>
            {streamMessages.map((msg, i) => (
              <div key={i} className="mb-1 flex items-center">
                {msg.type === 'progress' ? (
                  <>
                    <div className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin mr-1"></div>
                    <span>Still analyzing... (attempt {msg.attempts})</span>
                  </>
                ) : msg.type === 'complete' ? (
                  <>
                    <FiCheckCircle className="mr-1 text-green-500" />
                    <span className="text-green-500">Analysis complete!</span>
                  </>
                ) : (
                  <span>{msg.message}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Query tag */}
        {video.trend_queries && (
          <div className={`mt-auto pt-2 text-xs ${
            theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'
          }`}>
            Query: {video.trend_queries.query}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className={`p-4 border-t ${
        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
      } flex justify-between`}>
        <div className="flex space-x-3">
          <a
            href={video.video_url}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-sm font-medium flex items-center ${
              theme === 'dark' ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-800'
            }`}
          >
            <FiExternalLink className="mr-1" />
            View on TikTok
          </a>

          {video.download_url && (
            <a
              href={video.download_url}
              target="_blank"
              rel="noopener noreferrer"
              className={`text-sm font-medium flex items-center ${
                theme === 'dark' ? 'text-green-400 hover:text-green-300' : 'text-green-600 hover:text-green-800'
              }`}
            >
              <FiDownload className="mr-1" />
              Download
            </a>
          )}
        </div>

        <button
          onClick={analyzeVideo}
          disabled={isAnalyzing}
          className={`text-sm font-medium flex items-center ${
            isAnalyzing
              ? theme === 'dark' ? 'text-yellow-600 cursor-not-allowed' : 'text-yellow-400 cursor-not-allowed'
              : theme === 'dark' ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-800'
          }`}
        >
          {isAnalyzing ? (
            <>
              <div className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin mr-1"></div>
              Analyzing...
            </>
          ) : (
            <>
              <FiRefreshCw className="mr-1" />
              {isAnalysisComplete ? 'Re-Analyze' : 'Analyze'}
            </>
          )}
        </button>
      </div>

      {/* Details modal */}
      {showDetails && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowDetails(false)}
        >
          <div
            className={`${
              theme === 'dark' ? 'glass-card-dark' : 'glass-card-light'
            } w-full max-w-2xl rounded-xl overflow-hidden`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`p-4 flex justify-between items-center border-b ${
              theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
            }`}>
              <h3 className={`font-semibold ${
                theme === 'dark' ? 'text-white' : 'text-gray-800'
              }`}>
                Video Details
              </h3>
              <button
                onClick={() => setShowDetails(false)}
                className={`p-2 rounded-full ${
                  theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                }`}
              >
                <FiX />
              </button>
            </div>

            <div className="p-6">
              <div className="flex mb-6">
                {video.cover_url && (
                  <div className="w-1/3 mr-4">
                    <img
                      src={video.cover_url}
                      alt={video.caption}
                      className="w-full h-auto rounded-lg"
                    />
                  </div>
                )}

                <div className="flex-1">
                  <h4 className={`font-medium mb-2 ${
                    theme === 'dark' ? 'text-gray-100' : 'text-gray-800'
                  }`}>
                    {video.caption}
                  </h4>

                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <p className={`text-xs ${
                        theme === 'dark' ? 'text-gray-400' : 'text-black font-semibold'
                      }`}>
                        Likes
                      </p>
                      <p className={`font-semibold ${
                        theme === 'dark' ? 'text-pink-400' : 'text-pink-600'
                      }`}>
                        {video.likes.toLocaleString()}
                      </p>
                    </div>

                    <div>
                      <p className={`text-xs ${
                        theme === 'dark' ? 'text-gray-400' : 'text-black font-semibold'
                      }`}>
                        Views
                      </p>
                      <p className={`font-semibold ${
                        theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                      }`}>
                        {video.views.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {video.hashtags && video.hashtags.length > 0 && (
                    <div className="mt-4">
                      <p className={`text-xs mb-1 ${
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        Hashtags
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {video.hashtags.map((tag: string, index: number) => (
                          <span
                            key={index}
                            className={`px-2 py-0.5 rounded text-xs ${
                              theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {isAnalysisComplete && !isAnalysisFailed ? (
                <div>
                  <h4 className={`font-medium mb-2 ${
                    theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
                  }`}>
                    AI Analysis
                  </h4>
                  <div className={`text-sm ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                  } max-h-60 overflow-y-auto p-4 rounded-lg ${
                    theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-100'
                  }`}>
                    {(analysis || '').split('\n').map((line, index) => (
                      <p key={index} className={line.startsWith('#') ? 'font-bold mt-2' : 'mb-2'}>
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              ) : isAnalyzing ? (
                <div className={`p-4 rounded-lg ${
                  theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
                } text-center`}>
                  <div className="flex justify-center items-center space-x-2">
                    <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin"></div>
                    <p className={`text-sm ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-900'
                    }`}>
                      Analysis in progress... This may take a minute.
                    </p>
                  </div>

                  {streamMessages.length > 0 && (
                    <div className={`mt-4 text-xs ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    } max-h-40 overflow-y-auto text-left`}>
                      {streamMessages.map((msg, i) => (
                        <div key={i} className="mb-1 flex items-center">
                          {msg.type === 'progress' ? (
                            <>
                              <div className="w-2 h-2 rounded-full border-2 border-current border-t-transparent animate-spin mr-1"></div>
                              <span>Still analyzing... (attempt {msg.attempts})</span>
                            </>
                          ) : (
                            <span>{msg.message}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : isAnalysisFailed ? (
                <div className={`p-4 rounded-lg ${
                  theme === 'dark' ? 'bg-red-900/20' : 'bg-red-50'
                } text-center`}>
                  <p className={`text-sm ${
                    theme === 'dark' ? 'text-red-400' : 'text-red-600'
                  }`}>
                    {analysis || 'Analysis failed. Please try again.'}
                  </p>
                  <button
                    onClick={() => {
                      setShowDetails(false);
                      analyzeVideo();
                    }}
                    className={`mt-2 px-4 py-2 rounded-lg ${
                      theme === 'dark' ? 'bg-emerald-700 hover:bg-emerald-600' : 'bg-emerald-600 hover:bg-emerald-700'
                    } text-white text-sm`}
                  >
                    Retry Analysis
                  </button>
                </div>
              ) : (
                <div className={`p-4 rounded-lg ${
                  theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
                } text-center`}>
                  <p className={`text-sm ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-900'
                  }`}>
                    This video has not been analyzed yet.
                  </p>
                  <button
                    onClick={() => {
                      setShowDetails(false);
                      analyzeVideo();
                    }}
                    className={`mt-2 px-4 py-2 rounded-lg ${
                      theme === 'dark' ? 'bg-emerald-700 hover:bg-emerald-600' : 'bg-emerald-600 hover:bg-emerald-700'
                    } text-white text-sm`}
                  >
                    Analyze Now
                  </button>
                </div>
              )}

              <div className="mt-6 flex justify-end space-x-3">
                {video.video_url && (
                  <a
                    href={video.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`px-4 py-2 rounded-lg flex items-center ${
                      theme === 'dark' ? 'glass-button-dark' : 'glass-button-light'
                    } text-white`}
                  >
                    <FiExternalLink className="mr-2" />
                    View on TikTok
                  </a>
                )}

                {video.download_url && (
                  <a
                    href={video.download_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`px-4 py-2 rounded-lg flex items-center ${
                      theme === 'dark'
                        ? 'bg-green-600/80 hover:bg-green-600'
                        : 'bg-green-600 hover:bg-green-700'
                    } text-white`}
                  >
                    <FiDownload className="mr-2" />
                    Download
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
