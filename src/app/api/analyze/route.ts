import { NextResponse } from 'next/server'
import { spawn, type ChildProcess } from 'child_process'
import { createClient } from '@supabase/supabase-js'
import { promises as fs } from 'fs'
import path from 'path'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: Request) {
  try {
    const { videoUrl, videoId, userId, searchQuery } = await request.json()
    console.log('Starting video analysis:', { videoUrl, videoId, userId })

    // Store video metadata in temp_videos table
    const { error: insertError } = await supabase
      .from('temp_videos')
      .insert({
        user_id: userId,
        video_id: videoId,
        file_name: `${videoId}.mp4`,
        file_data: null, // Not storing the actual file data
        content_type: 'video/mp4'
      })
    
    if (insertError) {
      console.warn(`Warning: Failed to store video metadata: ${insertError.message}`)
      // Continue with analysis even if metadata storage fails
    } else {
      console.log('Video metadata stored in database successfully')
    }

    // Ensure output directory exists
    const outputDir = path.join(process.cwd(), 'output')
    await fs.mkdir(outputDir, { recursive: true })

    // Run video-analyzer directly on the URL
    const analyzer: ChildProcess = spawn('video-analyzer', [
      videoUrl,
      '--client', 'openai_api',
      '--api-key', process.env.TOGETHER_API_KEY!,
      '--api-url', 'https://api.together.xyz/v1',
      '--model', 'meta-llama/Llama-Vision-Free',
      '--max-frames', '2',
      '--duration', '60',
      '--log-level', 'INFO',
      '--whisper-model', 'medium',
      '--temperature', '0.7',
      '--prompt', 'Analyze this TikTok video and provide insights about: 1. Main activities shown 2. Visual elements and equipment 3. Style and techniques 4. Target audience 5. Key tips. Keep the analysis concise.'
    ])

    let errorText = ''

    // Collect stderr for logging
    analyzer.stderr?.on('data', (data) => {
      const text = data.toString()
      errorText += text
      console.log('video-analyzer stderr:', text)
    })

    // Wait for the analyzer to complete
    await new Promise<void>((resolve, reject) => {
      analyzer.on('close', (code) => {
        console.log(`Analyzer process exited with code ${code}`)
        if (code !== 0) {
          console.error('STDERR:', errorText)
        }
        resolve()
      })
      analyzer.on('error', (err) => {
        console.error('Analyzer process error:', err)
        reject(err)
      })
    })

    // Read the analysis from the output file
    const analysisFilePath = path.join(outputDir, 'analysis.json')
    console.log('Reading analysis from:', analysisFilePath)
    
    let analysisText
    try {
      const fileContent = await fs.readFile(analysisFilePath, 'utf-8')
      const analysisJson = JSON.parse(fileContent)
      
      // Extract only the video_description section
      if (analysisJson.video_description?.response) {
        analysisText = analysisJson.video_description.response
        console.log('Successfully extracted video description')
      } else {
        throw new Error('Video description not found in analysis output')
      }
    } catch (error) {
      console.error('Error reading/parsing analysis file:', error)
      throw new Error('Failed to read or parse analysis output file')
    }

    // Always try to save the analysis, even if it's partial
    console.log('Saving analysis to Supabase for video ID:', videoId)
    console.log('Analysis text to save:', analysisText)

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

    // Clean up the output file
    try {
      await fs.unlink(analysisFilePath)
      console.log('Cleaned up analysis file')
    } catch (error) {
      console.warn('Warning: Could not clean up analysis file:', error)
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