'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { searchTikTokVideos } from '@/lib/tiktok'
import { BusinessContext, TikTokVideo } from '@/types/analysis'

export default function Videos() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [progress, setProgress] = useState<string>('')
  const [numHashtags, setNumHashtags] = useState(2)
  const [videosPerHashtag, setVideosPerHashtag] = useState(2)
  const [allAnalyses, setAllAnalyses] = useState<any[]>([])

  const analyzeVideo = async (videoUrl: string, videoId: string, userId: string, searchQuery: string) => {
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          videoUrl,
          videoId,
          userId,
          searchQuery
        }),
      })

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`)
      }

      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error)
      }

      return data.result
    } catch (error) {
      console.error('Error analyzing video:', error)
      throw error
    }
  }

  const handleAnalyze = async () => {
    setLoading(true)
    setError(null)
    setSuccess(false)
    setProgress('Fetching business information...')
    setAllAnalyses([])

    try {
      // Get the current user's session
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      // Fetch user's business context
      const { data: userData, error: userError } = await supabase
        .from('user_onboarding')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (userError) throw userError

      if (!userData) {
        setError('Please complete your business profile in the onboarding section first.')
        return
      }

      if (!userData.business_type || !userData.business_location) {
        setError('Business type and location are required. Please complete your profile.')
        return
      }

      const businessContext: BusinessContext = {
        business_type: userData.business_type,
        business_location: userData.business_location
      }

      // Generate hashtags based on business type and number requested
      const baseHashtags = [
        `${userData.business_type} tips`,
        `${userData.business_type} tutorial`,
        `${userData.business_type} ideas`,
        `${userData.business_type} motivation`,
        `${userData.business_type} inspiration`
      ]
      
      // Limit to the number of hashtags selected (max 5)
      const hashtags = baseHashtags.slice(0, Math.min(numHashtags, 5))

      let allVideos: TikTokVideo[] = []
      let analysisResults: any[] = []

      // Search and analyze videos for each hashtag
      for (const hashtag of hashtags) {
        setProgress(`Searching for videos with hashtag: ${hashtag}...`)
        const videos = await searchTikTokVideos(hashtag, userData.business_location)
        
        if (!videos || videos.length === 0) {
          console.warn(`No videos found for hashtag: ${hashtag}`)
          continue
        }

        // Take only the number of videos per hashtag selected (max 5)
        const selectedVideos = videos.slice(0, Math.min(videosPerHashtag, 5))
        allVideos = [...allVideos, ...selectedVideos]
        
        // Analyze each video
        for (const video of selectedVideos) {
          setProgress(`Processing video: ${video.title}`)
          try {
            // First, save the video data
            await supabase
              .from('tiktok_videos')
              .insert({
                user_id: session.user.id,
                video_id: video.video_id,
                title: video.title,
                cover_url: video.cover_url,
                video_url: video.video_url,
                download_url: video.download_url,
                author: video.author,
                play_count: video.stats.play_count,
                like_count: video.stats.like_count,
                comment_count: video.stats.comment_count,
                share_count: video.stats.share_count,
                search_query: hashtag
              })

            // Then analyze the video
            setProgress(`Analyzing video: ${video.title}`)
            const analysisResult = await analyzeVideo(
              video.download_url, 
              video.video_id,
              session.user.id,
              hashtag
            )
            analysisResults.push(analysisResult)

          } catch (analysisError) {
            console.error(`Error processing video ${video.video_id}:`, analysisError)
            // Continue with next video even if this one fails
          }
        }
      }

      // If we have any successful analyses, analyze patterns
      if (analysisResults.length > 0) {
        setProgress('Analyzing patterns across videos...')
        try {
          const patternResponse = await fetch('/api/analyze-patterns', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              videoAnalyses: analysisResults,
              userId: session.user.id
            }),
          })

          if (!patternResponse.ok) {
            console.error('Pattern analysis failed:', await patternResponse.text())
          }
        } catch (patternError) {
          console.error('Error in pattern analysis:', patternError)
        }
      }

      setAllAnalyses(analysisResults)
      setSuccess(true)
    } catch (err) {
      console.error('Error during analysis:', err)
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setLoading(false)
      setProgress('')
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Analyzed Videos</h1>
      </div>

      {/* Settings Panel */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Analysis Settings</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label htmlFor="numHashtags" className="block text-sm font-medium text-gray-700 mb-1">
              Number of Hashtags (max 5)
            </label>
            <input
              type="range"
              id="numHashtags"
              min="1"
              max="5"
              value={numHashtags}
              onChange={(e) => setNumHashtags(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="text-sm text-gray-500 mt-1">{numHashtags} hashtag{numHashtags !== 1 ? 's' : ''}</div>
          </div>
          
          <div>
            <label htmlFor="videosPerHashtag" className="block text-sm font-medium text-gray-700 mb-1">
              Videos per Hashtag (max 5)
            </label>
            <input
              type="range"
              id="videosPerHashtag"
              min="1"
              max="5"
              value={videosPerHashtag}
              onChange={(e) => setVideosPerHashtag(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="text-sm text-gray-500 mt-1">{videosPerHashtag} video{videosPerHashtag !== 1 ? 's' : ''} per hashtag</div>
          </div>
        </div>
        
        <div className="flex justify-end">
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Analyzing...' : 'Start Analysis'}
          </button>
        </div>
      </div>

      {/* Progress Message */}
      {loading && progress && (
        <div className="rounded-md bg-blue-50 p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">In Progress</h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>{progress}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="rounded-md bg-green-50 p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">Success!</h3>
              <div className="mt-2 text-sm text-green-700">
                <p>Analysis complete! {allAnalyses?.length || 0} videos have been analyzed.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Placeholder content - You would replace this with your video list */}
      <div className="bg-white shadow rounded-lg">
        <div className="p-6">
          <div className="text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
              />
            </svg>
            <h3 className="mt-2 text-lg font-medium text-gray-900">No videos analyzed yet</h3>
            <p className="mt-1 text-sm text-gray-500">
              Use the settings above to configure your analysis and click "Start Analysis" to begin.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
} 