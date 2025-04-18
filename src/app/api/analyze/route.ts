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

// Check if video-analyzer is installed and working
async function isVideoAnalyzerInstalled() {
  try {
    // Try to run video-analyzer with --version flag
    await execAsync('video-analyzer --version')
    return true
  } catch (error) {
    console.warn('video-analyzer not installed or not in PATH:', error)
    
    // Try to check if it's installed in the Python user site packages
    try {
      const { stdout } = await execAsync('python3 -m site --user-base')
      const userBasePath = stdout.trim()
      const videoAnalyzerPath = path.join(userBasePath, 'bin', 'video-analyzer')
      
      if (fs.existsSync(videoAnalyzerPath)) {
        console.log('Found video-analyzer at:', videoAnalyzerPath)
        process.env.PATH = `${process.env.PATH}:${path.join(userBasePath, 'bin')}`
        return true
      }
    } catch (siteError) {
      console.warn('Error checking Python site packages:', siteError)
    }
    
    return false
  }
}

// Generate AI-based fallback analysis when video-analyzer isn't available
async function generateFallbackAnalysis(videoInfo: any) {
  try {
    const { videoUrl, videoId, searchQuery, videoTitle, playCount, likeCount, commentCount, author } = videoInfo
    
    // Create a basic fallback analysis with available metadata
    return {
      transcript: "Video transcript unavailable - analysis performed using metadata only",
      description: `This video appears to be related to "${searchQuery || 'your search topic'}". 
The video title "${videoTitle || 'Unknown'}" suggests content focused on ${searchQuery || 'general topics'}. 
It has received ${playCount || 'unknown'} views and ${likeCount || 'unknown'} likes, with ${commentCount || 'unknown'} comments.
Created by ${author || 'unknown creator'}.
To analyze this content more deeply, please view it directly on TikTok.`,
      metadata: {
        duration: "Unknown",
        resolution: "Unknown",
        title: videoTitle || "Unknown",
        author: author || "Unknown",
        engagement: {
          views: playCount || 0,
          likes: likeCount || 0,
          comments: commentCount || 0
        }
      }
    }
  } catch (error) {
    console.error('Error generating fallback analysis:', error)
    return {
      transcript: "Video analysis unavailable",
      description: "Unable to analyze this video. Please view it directly on TikTok.",
      metadata: { duration: "Unknown", resolution: "Unknown" }
    }
  }
}

export async function POST(request: Request) {
  try {
    // Extract video URL and info from the request
    const requestData = await request.json()
    const { videoUrl, videoId, userId, searchQuery, videoTitle, playCount, likeCount, commentCount, author } = requestData
    
    if (!videoUrl) {
      return NextResponse.json({ error: 'Video URL is required' }, { status: 400 })
    }

    console.log(`Analyzing video: ${videoUrl}`)
    
    // Ensure we have a valid search query for database constraints
    const safeSearchQuery = searchQuery || 'general content'
    
    // Check if video-analyzer is installed
    const analyzerInstalled = await isVideoAnalyzerInstalled()
    if (!analyzerInstalled) {
      console.warn('video-analyzer not available - generating fallback analysis')
      
      // Generate fallback analysis
      const fallbackAnalysis = await generateFallbackAnalysis(requestData)
      
      // Store the fallback analysis in Supabase if userId is provided
      if (userId && videoId) {
        const { error: dbError } = await supabase
          .from('video_analysis')
          .insert({
            user_id: userId,
            video_id: videoId,
            search_query: safeSearchQuery,
            analysis_result: fallbackAnalysis
          })

        if (dbError) {
          console.error('Error storing fallback analysis:', dbError)
        }
      }
      
      return NextResponse.json({ 
        success: true, 
        analysis: fallbackAnalysis,
        isPlaceholder: true,
        search_query: safeSearchQuery
      })
    }
    
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
      
      // If provided, store the video analysis
      if (userId && videoId) {
        const { error: dbError } = await supabase
          .from('video_analysis')
          .insert({
            user_id: userId,
            video_id: videoId,
            search_query: safeSearchQuery,
            analysis_result: analysis
          })

        if (dbError) {
          console.error('Error storing analysis:', dbError)
        }
      }
      
      // Clean up the temporary directory
      try {
        await execAsync(`rm -rf ${outputDir}`)
      } catch (cleanupError) {
        console.error('Error cleaning up temp directory:', cleanupError)
      }
      
      return NextResponse.json({ 
        success: true, 
        analysis,
        search_query: safeSearchQuery
      })
    } catch (analyzerError) {
      console.error('Error running video analyzer:', analyzerError)
      
      // Generate fallback analysis if actual analysis fails
      const fallbackAnalysis = await generateFallbackAnalysis(requestData)
      
      // Clean up the temporary directory if it exists
      try {
        if (fs.existsSync(outputDir)) {
          await execAsync(`rm -rf ${outputDir}`)
        }
      } catch (cleanupError) {
        console.error('Error cleaning up temp directory:', cleanupError)
      }
      
      // Store the fallback analysis if userId is provided
      if (userId && videoId) {
        const { error: dbError } = await supabase
          .from('video_analysis')
          .insert({
            user_id: userId,
            video_id: videoId,
            search_query: safeSearchQuery,
            analysis_result: fallbackAnalysis
          })

        if (dbError) {
          console.error('Error storing fallback analysis:', dbError)
        }
      }
      
      return NextResponse.json({ 
        success: true, 
        analysis: fallbackAnalysis,
        isPlaceholder: true,
        search_query: safeSearchQuery,
        originalError: `Failed to analyze video: ${analyzerError instanceof Error ? analyzerError.message : 'Unknown error'}`
      })
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