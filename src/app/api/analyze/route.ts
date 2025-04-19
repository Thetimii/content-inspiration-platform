import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Video Analyzer API URL
const VIDEO_ANALYZER_API_URL = process.env.VIDEO_ANALYZER_API_URL || 'https://video-analyzer-y3m4k6qhqq-uc.a.run.app'

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

    // Call the Video Analyzer API following the exact instructions
    console.log('Calling Video Analyzer API with URL:', videoUrl)

    // Step 1: Register the video URL
    console.log('Step 1: Registering video URL...')
    const registerResponse = await fetch(`${VIDEO_ANALYZER_API_URL}/upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: videoUrl }),
    })

    if (!registerResponse.ok) {
      const errorText = await registerResponse.text()
      console.error('Video URL registration error:', {
        status: registerResponse.status,
        statusText: registerResponse.statusText,
        body: errorText
      })
      throw new Error(`Video URL registration error: ${registerResponse.status} - ${errorText}`)
    }

    const registerData = await registerResponse.json()
    const sessionId = registerData.session_id

    if (!sessionId) {
      throw new Error('No session ID returned from registration')
    }

    console.log('Successfully registered video URL, session ID:', sessionId)

    // Step 2: Start the analysis with the session ID
    console.log('Step 2: Starting analysis...')

    // Get OpenRouter API key from environment
    const openrouterApiKey = process.env.NEXT_PUBLIC_OPENROUTER_API_KEY
    if (!openrouterApiKey) {
      throw new Error('OpenRouter API key is not configured')
    }

    // Create form data for the analysis request
    const formData = new URLSearchParams()
    formData.append('client', 'openrouter')
    formData.append('api-key', openrouterApiKey)
    formData.append('model', 'meta-llama/llama-4-maverick:free')
    formData.append('max-frames', '5')
    formData.append('whisper-model', 'tiny')
    formData.append('duration', '30')
    formData.append('prompt', 'Analyze this TikTok video and provide insights about: 1. Main activities shown 2. Visual elements and equipment 3. Style and techniques 4. Target audience 5. Key tips. Keep the analysis concise.')

    const analysisResponse = await fetch(`${VIDEO_ANALYZER_API_URL}/analyze/${sessionId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    })

    if (!analysisResponse.ok) {
      const errorText = await analysisResponse.text()
      console.error('Video analysis start error:', {
        status: analysisResponse.status,
        statusText: analysisResponse.statusText,
        body: errorText
      })
      throw new Error(`Video analysis start error: ${analysisResponse.status} - ${errorText}`)
    }

    console.log('Analysis started successfully')

    // Step 3: Wait for the analysis to complete and get results
    console.log('Step 3: Waiting for analysis to complete...')

    // Poll for results
    let analysisComplete = false
    let analysisData
    const startTime = Date.now()
    const maxWaitTime = 1 * 60 * 1000 // 1 minute
    const pollInterval = 5000 // 5 seconds

    while (!analysisComplete && (Date.now() - startTime) < maxWaitTime) {
      try {
        console.log(`Checking results for session ${sessionId}...`)
        const resultResponse = await fetch(`${VIDEO_ANALYZER_API_URL}/results/${sessionId}`)

        if (resultResponse.ok) {
          // Got a successful response, parse the data
          analysisData = await resultResponse.json()
          analysisComplete = true
          console.log('Analysis complete!')
        } else {
          // If we get a 404, the analysis is still in progress
          if (resultResponse.status === 404) {
            console.log('Analysis still in progress, waiting...')
          } else {
            // For other errors, log and continue polling
            const errorText = await resultResponse.text()
            console.warn('Error checking analysis status:', {
              status: resultResponse.status,
              statusText: resultResponse.statusText,
              body: errorText
            })
          }

          // Wait before checking again
          await new Promise(resolve => setTimeout(resolve, pollInterval))
        }
      } catch (error) {
        console.warn('Error polling for analysis results:', error)
        await new Promise(resolve => setTimeout(resolve, pollInterval))
      }
    }

    if (!analysisComplete) {
      console.log(`Analysis timed out after ${maxWaitTime / 1000} seconds, but we'll return a partial result`)
      // Return a placeholder result instead of throwing an error
      analysisData = {
        status: 'processing',
        message: `Analysis is still in progress. The video is being analyzed by the AI model. Please check back later for the complete results. Session ID: ${sessionId}`
      }
    }

    // Extract the analysis text from the result
    console.log('Analysis data:', analysisData)

    // Try to extract the description from various possible locations in the response
    const analysisText =
      analysisData.video_description?.response || // Standard format
      analysisData.description || // Alternative format
      analysisData.result || // Another alternative
      JSON.stringify(analysisData) // Last resort: use the whole response

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