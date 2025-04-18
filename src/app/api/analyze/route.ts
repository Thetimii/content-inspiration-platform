import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Video Analyzer API URL
const VIDEO_ANALYZER_API_URL = process.env.VIDEO_ANALYZER_API_URL || 'https://video-analyzer-api-xxxxx-xx.a.run.app'

export async function POST(request: Request) {
  try {
    const { videoUrl, videoId, userId, searchQuery } = await request.json()
    console.log('Starting video analysis:', { videoUrl, videoId, userId })

    if (!videoUrl || !videoId || !userId) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameters: videoUrl, videoId, or userId'
      }, { status: 400 })
    }

    // Store video metadata in temp_videos table
    // Create a placeholder buffer for file_data since it can't be null
    const placeholderBuffer = new Uint8Array(1); // 1-byte placeholder

    const { error: insertError } = await supabase
      .from('temp_videos')
      .insert({
        user_id: userId,
        video_id: videoId,
        file_name: `${videoId}.mp4`,
        file_data: placeholderBuffer, // Using placeholder instead of null
        content_type: 'video/mp4'
      })

    if (insertError) {
      console.warn(`Warning: Failed to store video metadata: ${insertError.message}`)
      // Continue with analysis even if metadata storage fails
    } else {
      console.log('Video metadata stored in database successfully')
    }

    // Call the Video Analyzer API
    console.log('Calling Video Analyzer API with URL:', videoUrl)

    const analyzerResponse = await fetch(`${VIDEO_ANALYZER_API_URL}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: videoUrl }),
    })

    if (!analyzerResponse.ok) {
      const errorText = await analyzerResponse.text()
      console.error('Video Analyzer API error:', {
        status: analyzerResponse.status,
        statusText: analyzerResponse.statusText,
        body: errorText
      })
      throw new Error(`Video analysis service error: ${analyzerResponse.status} - ${errorText}`)
    }

    // Get the analysis result
    const analysisData = await analyzerResponse.json()
    const analysisText = analysisData.description

    if (!analysisText) {
      console.error('API response:', analysisData)
      throw new Error('No video description returned from the API')
    }

    console.log('Successfully received video description from API')

    // Save the analysis to Supabase
    console.log('Saving analysis to Supabase for video ID:', videoId)

    const { error: saveError } = await supabase
      .from('video_analysis')
      .upsert({
        user_id: userId,
        video_id: videoId,
        search_query: searchQuery || '',
        analysis_result: analysisText,
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })

    if (saveError) {
      console.error('Error saving to Supabase:', saveError)
      return NextResponse.json({
        success: false,
        error: `Database error: ${saveError.message}`
      }, { status: 500 })
    }

    // No cleanup needed when using the API

    return NextResponse.json({
      success: true,
      result: analysisText
    })
  } catch (error) {
    console.error('Error in video analysis:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 })
  }
}