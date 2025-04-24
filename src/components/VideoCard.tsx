'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiHeart, FiEye, FiDownload, FiExternalLink, FiInfo, FiX, FiRefreshCw, FiLink } from 'react-icons/fi';
import { useTheme } from '@/utils/themeContext';

interface VideoCardProps {
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
  onAnalyze?: (videoId: string) => void;
  isAnalyzing?: boolean;
  onGetCleanUrl?: (videoId: string) => void;
  isGettingCleanUrl?: boolean;
}

export default function VideoCard({ video, onAnalyze, isAnalyzing, onGetCleanUrl, isGettingCleanUrl }: VideoCardProps) {
  const { theme } = useTheme();
  const [showDetails, setShowDetails] = useState(false);

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
          video.frame_analysis
            ? theme === 'dark' ? 'bg-green-900/70 text-green-300' : 'bg-green-100 text-green-800'
            : isAnalyzing
              ? theme === 'dark' ? 'bg-yellow-900/70 text-yellow-300' : 'bg-yellow-100 text-yellow-800'
              : theme === 'dark' ? 'bg-gray-900/70 text-gray-300' : 'bg-gray-100 text-gray-800'
        } backdrop-blur-sm`}>
          {video.frame_analysis ? 'Analyzed' : isAnalyzing ? 'Analyzing...' : 'Not Analyzed'}
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

        <div className="flex space-x-2">
          {onGetCleanUrl && (
            <button
              onClick={() => onGetCleanUrl(video.id)}
              disabled={isGettingCleanUrl}
              className={`text-sm font-medium flex items-center ${
                isGettingCleanUrl
                  ? theme === 'dark' ? 'text-blue-600 cursor-not-allowed' : 'text-blue-400 cursor-not-allowed'
                  : theme === 'dark' ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'
              }`}
            >
              {isGettingCleanUrl ? (
                <>
                  <div className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin mr-1"></div>
                  Getting URL...
                </>
              ) : (
                <>
                  <FiLink className="mr-1" />
                  Get Clean URL
                </>
              )}
            </button>
          )}

          {onAnalyze && !video.frame_analysis && (
            <button
              onClick={() => onAnalyze(video.id)}
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
                  Analyze
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Details modal */}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowDetails(false)}
          >
            <motion.div
              className={`${
                theme === 'dark' ? 'glass-card-dark' : 'glass-card-light'
              } w-full max-w-2xl rounded-xl overflow-hidden`}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
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
                <motion.button
                  onClick={() => setShowDetails(false)}
                  className={`p-2 rounded-full ${
                    theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                  }`}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <FiX />
                </motion.button>
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

                {video.frame_analysis ? (
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
                      {video.frame_analysis.split('\n').map((line, index) => (
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
                        Analysis in progress...
                      </p>
                    </div>
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
                    {onAnalyze && (
                      <button
                        onClick={() => {
                          setShowDetails(false);
                          onAnalyze(video.id);
                        }}
                        className={`mt-2 px-4 py-2 rounded-lg ${
                          theme === 'dark' ? 'bg-emerald-700 hover:bg-emerald-600' : 'bg-emerald-600 hover:bg-emerald-700'
                        } text-white text-sm`}
                      >
                        Analyze Now
                      </button>
                    )}
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
