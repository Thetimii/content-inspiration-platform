'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiCalendar, FiClock, FiChevronDown, FiChevronUp, FiExternalLink } from 'react-icons/fi';
import { useTheme } from '@/utils/themeContext';

interface RecommendationCardProps {
  recommendation: {
    id: string;
    created_at: string;
    combined_summary?: string;
    content_ideas?: string | string[];
  };
  onViewFull: (id: string) => void;
}

export default function RecommendationCard({ recommendation, onViewFull }: RecommendationCardProps) {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);
  
  // Format date
  const formattedDate = new Date(recommendation.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  // Format time
  const formattedTime = new Date(recommendation.created_at).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  // Parse content ideas
  const getContentIdeas = () => {
    if (!recommendation.content_ideas) return [];
    
    if (typeof recommendation.content_ideas === 'string') {
      try {
        return JSON.parse(recommendation.content_ideas);
      } catch (e) {
        // If it's not valid JSON, split by newlines or commas
        return recommendation.content_ideas.split(/[\n,]/).filter(Boolean).map(item => item.trim());
      }
    }
    
    return recommendation.content_ideas;
  };
  
  const contentIdeas = getContentIdeas();
  
  // Extract sections from combined_summary
  const extractSections = () => {
    if (!recommendation.combined_summary) return {};
    
    const sections: Record<string, string> = {};
    const content = recommendation.combined_summary;
    
    // Extract sections using regex
    const videoAnalysisMatch = content.match(/## \ud83d\udcca Video Analysis([\\s\\S]*?)(?=## \ud83c\udfac|## \ud83d\udcdd|## \ud83d\udca1|$)/);
    const technicalMatch = content.match(/## \ud83c\udfac Technical Breakdown([\\s\\S]*?)(?=## \ud83d\udcca|## \ud83d\udcdd|## \ud83d\udca1|$)/);
    const guideMatch = content.match(/## \ud83d\udcdd Content Creation Guide([\\s\\S]*?)(?=## \ud83d\udcca|## \ud83c\udfac|## \ud83d\udca1|$)/);
    const ideasMatch = content.match(/## \ud83d\udca1 5 Content Ideas([\\s\\S]*?)(?=$)/);
    
    if (videoAnalysisMatch) sections.videoAnalysis = videoAnalysisMatch[1].trim();
    if (technicalMatch) sections.technicalBreakdown = technicalMatch[1].trim();
    if (guideMatch) sections.contentGuide = guideMatch[1].trim();
    if (ideasMatch) sections.contentIdeas = ideasMatch[1].trim();
    
    return sections;
  };
  
  const sections = extractSections();
  
  return (
    <motion.div
      className={`${
        theme === 'dark' ? 'glass-card-dark' : 'glass-card-light'
      } rounded-xl overflow-hidden`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      layoutId={`recommendation-${recommendation.id}`}
    >
      <div className={`p-5 border-b ${
        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
      }`}>
        <div className="flex justify-between items-start">
          <div>
            <h3 className={`text-lg font-semibold ${
              theme === 'dark' ? 'text-white' : 'text-gray-800'
            }`}>
              TikTok Trend Analysis
            </h3>
            
            <div className="flex items-center mt-1 space-x-4">
              <div className={`flex items-center text-sm ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`}>
                <FiCalendar className="mr-1" size={14} />
                {formattedDate}
              </div>
              
              <div className={`flex items-center text-sm ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`}>
                <FiClock className="mr-1" size={14} />
                {formattedTime}
              </div>
            </div>
          </div>
          
          <motion.button
            onClick={() => setExpanded(!expanded)}
            className={`p-2 rounded-full ${
              theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            } ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <FiChevronUp size={20} /> : <FiChevronDown size={20} />}
          </motion.button>
        </div>
      </div>
      
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="p-5 space-y-4">
              {/* Video Analysis Section */}
              {sections.videoAnalysis && (
                <div>
                  <h4 className={`text-md font-medium mb-2 flex items-center ${
                    theme === 'dark' ? 'text-indigo-300' : 'text-indigo-700'
                  }`}>
                    <span className="mr-2">📊</span>
                    Video Analysis
                  </h4>
                  <p className={`text-sm ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    {sections.videoAnalysis.length > 200 
                      ? `${sections.videoAnalysis.substring(0, 200)}...` 
                      : sections.videoAnalysis}
                  </p>
                </div>
              )}
              
              {/* Technical Breakdown Section */}
              {sections.technicalBreakdown && (
                <div>
                  <h4 className={`text-md font-medium mb-2 flex items-center ${
                    theme === 'dark' ? 'text-indigo-300' : 'text-indigo-700'
                  }`}>
                    <span className="mr-2">🎬</span>
                    Technical Breakdown
                  </h4>
                  <p className={`text-sm ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    {sections.technicalBreakdown.length > 200 
                      ? `${sections.technicalBreakdown.substring(0, 200)}...` 
                      : sections.technicalBreakdown}
                  </p>
                </div>
              )}
              
              {/* Content Ideas Preview */}
              {contentIdeas.length > 0 && (
                <div>
                  <h4 className={`text-md font-medium mb-2 flex items-center ${
                    theme === 'dark' ? 'text-indigo-300' : 'text-indigo-700'
                  }`}>
                    <span className="mr-2">💡</span>
                    Content Ideas
                  </h4>
                  <ul className={`list-disc pl-5 space-y-1 text-sm ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    {contentIdeas.slice(0, 2).map((idea: string, index: number) => (
                      <li key={index}>{idea}</li>
                    ))}
                    {contentIdeas.length > 2 && (
                      <li className="list-none text-sm italic">
                        {contentIdeas.length - 2} more ideas...
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <div className={`p-4 ${
        theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'
      } flex justify-end`}>
        <motion.button
          onClick={() => onViewFull(recommendation.id)}
          className={`${
            theme === 'dark' ? 'glass-button-dark' : 'glass-button-light'
          } px-4 py-2 rounded-lg text-white flex items-center`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <FiExternalLink className="mr-2" />
          View Full Recommendation
        </motion.button>
      </div>
    </motion.div>
  );
}
