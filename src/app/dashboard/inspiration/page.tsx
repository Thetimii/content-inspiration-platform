'use client'

import { useState, useEffect } from 'react'
import { SparklesIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { supabase } from '@/lib/supabase'
import { formatDistanceToNow } from 'date-fns'

interface PatternAnalysis {
  id: string
  user_id: string
  pattern_analysis: string
  created_at: string
  num_videos_analyzed: number
}

export default function Inspiration() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [patternAnalysis, setPatternAnalysis] = useState<PatternAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchLatestAnalysis = async () => {
    try {
      setRefreshing(true)
      // Get the current authenticated user
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        setError('Please sign in to view your content inspiration')
        setLoading(false)
        return
      }

      // Fetch the most recent pattern analysis for the current user
      const { data, error } = await supabase
        .from('pattern_analyses')
        .select('id, user_id, pattern_analysis, created_at, num_videos_analyzed')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error) {
        console.error('Error fetching pattern analysis:', error)
        setError('Failed to load inspiration content')
      } else if (data) {
        setPatternAnalysis(data)
        setError(null)
      }
    } catch (err) {
      console.error('Error in fetching pattern analysis:', err)
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchLatestAnalysis()
  }, [])

  // Helper function to format the pattern analysis text with proper styling
  const formatAnalysisText = (text: string) => {
    if (!text) return []

    // Try to detect if the text is already formatted in the expected way
    // Common patterns include numbered sections (1. TITLE) or just section titles in caps
    
    // First split by numbered sections (1. SECTION TITLE)
    let sections = text.split(/\d+\.\s+(?=[A-Z])/).filter(Boolean)
    
    // If that didn't work well (only one section), try splitting by all-caps lines
    if (sections.length <= 1) {
      const lines = text.split('\n')
      const sectionIndexes: number[] = []
      
      // Find lines that look like section titles (ALL CAPS)
      lines.forEach((line, index) => {
        if (/^[A-Z][A-Z\s]+$/.test(line.trim())) {
          sectionIndexes.push(index)
        }
      })
      
      // If we found potential section titles
      if (sectionIndexes.length > 0) {
        sections = []
        // Extract each section based on indexes
        sectionIndexes.forEach((startIndex, i) => {
          const endIndex = sectionIndexes[i + 1] || lines.length
          const sectionLines = lines.slice(startIndex, endIndex)
          sections.push(sectionLines.join('\n'))
        })
      }
    }
    
    // If we still don't have multiple sections, create a default one
    if (sections.length === 0) {
      sections = [text]
    }
    
    return sections.map((section, index) => {
      // Try to extract a section title (various formats)
      let title: string
      let content: string
      
      // Try to match an all-caps title at the beginning
      const titleMatch = section.match(/^([A-Z][A-Z\s]+)(?:\n|\r\n?)/)
      
      if (titleMatch) {
        title = titleMatch[1].trim()
        content = section.substring(titleMatch[0].length).trim()
      } else {
        // No clear title found, use a generic one
        title = `Key Insights ${index + 1}`
        content = section.trim()
      }
      
      // Process content into bullet points
      let bulletPoints: string[] = []
      
      // First try to split by bullet points with dashes
      if (content.includes('\n- ')) {
        bulletPoints = content
          .split(/\n-\s+/)
          .filter(Boolean)
          .map(point => point.trim())
      } 
      // Then try to split by bullet points with asterisks
      else if (content.includes('\n* ')) {
        bulletPoints = content
          .split(/\n\*\s+/)
          .filter(Boolean)
          .map(point => point.trim())
      }
      // Then try to split by bullet points with bullets
      else if (content.includes('\n• ')) {
        bulletPoints = content
          .split(/\n•\s+/)
          .filter(Boolean)
          .map(point => point.trim())
      }
      // If no bullet points found, split by newlines
      else if (content.includes('\n')) {
        bulletPoints = content
          .split('\n')
          .filter(line => line.trim().length > 0)
          .map(line => line.trim())
      } 
      // If no structure found, keep as a single point
      else {
        bulletPoints = [content]
      }
      
      return { title, bulletPoints }
    })
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Today's Inspiration</h1>
        <div className="flex items-center space-x-2">
          <button 
            onClick={fetchLatestAnalysis}
            disabled={loading || refreshing}
            className={`inline-flex items-center px-3 py-1.5 text-sm ${refreshing || loading ? 'text-gray-400 cursor-not-allowed' : 'text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50'} rounded-md transition-colors`}
            title="Refresh analysis"
          >
            <ArrowPathIcon className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="ml-1.5">{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
          <SparklesIcon className="h-6 w-6 text-indigo-600" />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-md mb-6">
          {error}
        </div>
      )}

      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Content Pattern Analysis</h2>
          {patternAnalysis && (
            <span className="text-xs text-gray-500">
              Updated {formatDistanceToNow(new Date(patternAnalysis.created_at))} ago
              • Based on {patternAnalysis.num_videos_analyzed} video{patternAnalysis.num_videos_analyzed !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        
        <p className="text-sm text-gray-600 mb-6">
          Based on your analyzed videos, here are insights and recommendations for your content creation.
        </p>

        {loading ? (
          <div className="space-y-6">
            <div className="animate-pulse space-y-4 border-l-4 border-gray-300 pl-4 py-2">
              <div className="h-5 bg-gray-200 rounded w-1/3"></div>
              <div className="space-y-2">
                <div className="h-3.5 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3.5 bg-gray-200 rounded w-5/6"></div>
                <div className="h-3.5 bg-gray-200 rounded w-2/3"></div>
              </div>
            </div>
            
            <div className="animate-pulse space-y-4 border-l-4 border-gray-300 pl-4 py-2">
              <div className="h-5 bg-gray-200 rounded w-1/2"></div>
              <div className="space-y-2">
                <div className="h-3.5 bg-gray-200 rounded w-full"></div>
                <div className="h-3.5 bg-gray-200 rounded w-4/5"></div>
                <div className="h-3.5 bg-gray-200 rounded w-3/4"></div>
              </div>
            </div>
          </div>
        ) : patternAnalysis ? (
          <div className="space-y-10">
            {formatAnalysisText(patternAnalysis.pattern_analysis).map((section, index) => (
              <div key={index} className="group">
                <div className="border-l-4 border-indigo-500 pl-4 mb-4">
                  <h3 className="text-lg font-medium text-gray-900 group-hover:text-indigo-700 transition-colors">
                    {section.title}
                  </h3>
                </div>
                <ul className="mt-4 space-y-3 pl-6">
                  {section.bulletPoints.map((point, pointIndex) => (
                    <li key={pointIndex} className="text-sm text-gray-700 leading-relaxed">
                      <span className="text-indigo-600 font-bold mr-2">•</span>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <div className="border-l-4 border-indigo-500 pl-4 bg-indigo-50 p-4 rounded-r-md">
            <h3 className="text-lg font-medium text-gray-900">No Analysis Available Yet</h3>
            <p className="mt-2 text-sm text-gray-600">
              We need to analyze some videos first. Head over to the "Analyzed Videos" section to 
              select and analyze videos for personalized content recommendations.
            </p>
            <a 
              href="/dashboard/videos" 
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Analyze Videos Now
            </a>
          </div>
        )}
      </div>
    </div>
  )
} 