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
    // Extract video URL and info from the request
    const requestData = await request.json()
    const { videoUrl, videoId, userId, searchQuery, videoTitle } = requestData
    
    if (!videoUrl) {
      return NextResponse.json({ error: 'Video URL is required' }, { status: 400 })
    }

    console.log(`Analyzing video: ${videoUrl}`)
    
    // Create a unique output directory for each analysis
    const outputDir = path.join('/tmp', `video-analysis-${uuidv4()}`)
    
    try {
      // Ensure output directory exists
      await execAsync(`mkdir -p ${outputDir}`)
      
      // First check if video-analyzer is in PATH
      const videoAnalyzerPath = await findVideoAnalyzerPath();
      if (!videoAnalyzerPath) {
        throw new Error('Video analyzer command not found in PATH')
      }
      
      // Run the video-analyzer command on the provided video URL
      const cmd = `${videoAnalyzerPath} "${videoUrl}" --output-dir "${outputDir}"`
      console.log(`Executing command: ${cmd}`)
      
      const { stdout, stderr } = await execAsync(cmd)
      console.log('Analysis completed:', stdout)
      if (stderr) console.log('Analysis stderr:', stderr)
      
      // Read the analysis results
      const analysisJsonPath = path.join(outputDir, 'analysis.json')
      if (!fs.existsSync(analysisJsonPath)) {
        throw new Error('Analysis failed to generate output file')
      }
      
      const analysisJson = fs.readFileSync(analysisJsonPath, 'utf8')
      const analysis = JSON.parse(analysisJson)
      
      // Store the video analysis in Supabase
      if (userId && videoId) {
        const { error: dbError } = await supabase
          .from('video_analysis')
          .insert({
            user_id: userId,
            video_id: videoId,
            search_query: searchQuery || 'general content',
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
        analysis
      })
    } catch (error) {
      console.error('Error running video analyzer:', error)
      
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
        error: error instanceof Error ? error.message : 'Unknown error analyzing video'
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

// Find video-analyzer in various possible locations
async function findVideoAnalyzerPath() {
  try {
    // First try the standard PATH
    try {
      const { stdout } = await execAsync('which video-analyzer')
      if (stdout.trim()) return stdout.trim()
    } catch (e) {
      console.log('video-analyzer not found in standard PATH')
    }
    
    // Try Python user base location
    try {
      const { stdout: userBase } = await execAsync('python3 -m site --user-base')
      const binPath = path.join(userBase.trim(), 'bin', 'video-analyzer')
      
      if (fs.existsSync(binPath)) {
        console.log('Found video-analyzer at:', binPath)
        return binPath
      }
    } catch (e) {
      console.log('Could not determine Python user base path')
    }
    
    // Try common Python paths in Vercel environment
    const possiblePaths = [
      '/var/task/.pythonbrew/scripts/video-analyzer',
      '/opt/python/bin/video-analyzer',
      '/var/lang/bin/video-analyzer',
      './.vercel/cache/video-analyzer/bin/video-analyzer',
      './node_modules/.bin/video-analyzer'
    ]
    
    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        console.log('Found video-analyzer at:', testPath)
        return testPath
      }
    }
    
    return null
  } catch (error) {
    console.error('Error finding video-analyzer path:', error)
    return null
  }
} 