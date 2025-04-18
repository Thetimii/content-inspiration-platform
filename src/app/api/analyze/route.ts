import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

const execAsync = promisify(exec)

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: Request) {
  try {
    // Extract video URL from the request
    const { videoUrl, userId, videoTitle, playCount, likeCount, author } = await request.json()
    if (!videoUrl) {
      return NextResponse.json({ error: 'Video URL is required' }, { status: 400 })
    }

    console.log(`Analyzing video: ${videoUrl}`)
    
    // Create a unique output directory for each analysis
    const outputDir = path.join('/tmp', `video-analysis-${uuidv4()}`)
    
    try {
      // Ensure output directory exists
      await execAsync(`mkdir -p ${outputDir}`)
      
      // Run the video-analyzer command on the provided video URL
      const cmd = `video-analyzer "${videoUrl}" --output-dir "${outputDir}"`
      console.log(`Executing command: ${cmd}`)
      
      const { stdout, stderr } = await execAsync(cmd)
      console.log('Analysis completed:', stdout)
      if (stderr) console.error('Analysis stderr:', stderr)
      
      // Read the analysis results
      const analysisJsonPath = path.join(outputDir, 'analysis.json')
      if (!fs.existsSync(analysisJsonPath)) {
        throw new Error('Analysis failed to generate output file')
      }
      
      const analysisJson = fs.readFileSync(analysisJsonPath, 'utf8')
      const analysis = JSON.parse(analysisJson)
      
      // Store the analysis in Supabase
      // Skipping temp_videos table insert to avoid the not-null constraint error
      
      // If provided, store the video analysis
      const { error: dbError } = await supabase
        .from('video_analyses')
        .insert({
          user_id: userId,
          video_url: videoUrl,
          video_title: videoTitle,
          play_count: playCount,
          like_count: likeCount,
          author_username: author,
          analysis_result: analysis,
          created_at: new Date().toISOString()
        })

      if (dbError) {
        console.error('Error storing analysis:', dbError)
      }
      
      // Clean up the temporary directory
      try {
        await execAsync(`rm -rf ${outputDir}`)
      } catch (cleanupError) {
        console.error('Error cleaning up temp directory:', cleanupError)
      }
      
      return NextResponse.json({ 
        success: true, 
        analysis 
      })
    } catch (analyzerError) {
      console.error('Error running video analyzer:', analyzerError)
      
      // Clean up the temporary directory if it exists
      try {
        if (fs.existsSync(outputDir)) {
          await execAsync(`rm -rf ${outputDir}`)
        }
      } catch (cleanupError) {
        console.error('Error cleaning up temp directory:', cleanupError)
      }
      
      return NextResponse.json({ 
        success: false, 
        error: `Failed to analyze video: ${analyzerError instanceof Error ? analyzerError.message : 'Unknown error'}`
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Error in video analysis:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      },
      { status: 500 }
    )
  }
} 