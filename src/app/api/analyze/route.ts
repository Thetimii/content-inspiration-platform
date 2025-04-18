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

// Function to check if we're running in Vercel production environment
const isVercelProd = () => {
  return process.env.VERCEL === '1' || process.env.VERCEL_ENV === 'production';
};

// Function to generate a simple AI analysis without using the video-analyzer binary
const generateBasicAnalysis = async (videoId: string, searchQuery: string) => {
  // Generate a basic analysis with search query context
  return `Video Analysis for ID: ${videoId}
  
Search Query: ${searchQuery}

CONTENT SUMMARY
This video was identified as potentially relevant to "${searchQuery}". Without direct video processing capabilities in this environment, a complete analysis couldn't be performed. However, the following general insights can be provided:

KEY ELEMENTS
- Videos matching "${searchQuery}" typically showcase demonstrations, tutorials, or informational content
- Visual elements often include close-ups of the subject matter, explanatory graphics, and/or presenter interactions
- These videos generally feature clear audio explanations accompanying visual demonstrations

AUDIENCE & ENGAGEMENT
- Target audience likely includes people interested in learning about ${searchQuery.split(' ').slice(-1)[0]}
- Most successful videos in this category provide actionable advice and clear instructions
- Engagement typically comes from providing value through knowledge-sharing and practical tips

RECREATION RECOMMENDATIONS
- Create well-lit, clearly visible demonstrations
- Include concise, informative narration
- Structure content with a clear beginning (problem/need), middle (demonstration), and end (results/benefits)
- Consider adding text overlays for key points
- Keep videos concise and focused on delivering valuable information

This analysis is a generalized assessment based on the search query. For more detailed, video-specific analysis, consider reviewing the content manually.`;
};

export async function POST(request: Request) {
  try {
    const { videoUrl, videoId, userId, searchQuery } = await request.json()
    console.log('Starting video analysis:', { videoUrl, videoId, userId })

    // Store video metadata in temp_videos table
    try {
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
      } else {
        console.log('Video metadata stored in database successfully')
      }
    } catch (dbError) {
      console.warn('Error storing video metadata:', dbError);
      // Continue even if this fails
    }

    // Check if we're running in Vercel production - if so, use a fallback approach
    let analysisText = '';
    
    if (isVercelProd()) {
      console.log('Running in Vercel production environment - using fallback analysis generation');
      analysisText = await generateBasicAnalysis(videoId, searchQuery);
    } else {
      // Local development flow with video-analyzer
      try {
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

        // Add timeout for the analyzer process
        let analyzerTimeout: NodeJS.Timeout | null = null;
        
        // Wait for the analyzer to complete
        await new Promise<void>((resolve, reject) => {
          // Set a timeout of 60 seconds to kill the process if it takes too long
          analyzerTimeout = setTimeout(() => {
            if (analyzer.pid) {
              try {
                process.kill(analyzer.pid);
              } catch (error) {
                console.error('Error killing analyzer process:', error);
              }
            }
            reject(new Error('Analysis timed out after 60 seconds'));
          }, 60000);
          
          analyzer.on('close', (code) => {
            if (analyzerTimeout) clearTimeout(analyzerTimeout);
            console.log(`Analyzer process exited with code ${code}`)
            if (code !== 0) {
              console.error('STDERR:', errorText)
              reject(new Error(`Analyzer process failed with code ${code}: ${errorText}`))
            } else {
              resolve()
            }
          })
          
          analyzer.on('error', (err) => {
            if (analyzerTimeout) clearTimeout(analyzerTimeout);
            console.error('Analyzer process error:', err)
            reject(err)
          })
        }).catch(error => {
          console.error('Analysis process error:', error);
          // Continue with backup plan or return an error
          throw new Error(`Video analysis failed: ${error.message}`);
        });

        // Read the analysis from the output file
        const analysisFilePath = path.join(outputDir, 'analysis.json')
        console.log('Reading analysis from:', analysisFilePath)
        
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

          // Clean up the output file
          try {
            await fs.unlink(analysisFilePath)
            console.log('Cleaned up analysis file')
          } catch (error) {
            console.warn('Warning: Could not clean up analysis file:', error)
          }
        } catch (error) {
          console.error('Error reading/parsing analysis file:', error)
          throw new Error('Failed to read or parse analysis output file')
        }
      } catch (analysisError) {
        console.error('Error in local video analysis:', analysisError);
        analysisText = await generateBasicAnalysis(videoId, searchQuery);
      }
    }

    // Always try to save the analysis, even if it's a fallback
    console.log('Saving analysis to Supabase for video ID:', videoId);
    
    try {
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
        // Continue anyway to return the analysis to the user
      }
    } catch (dbError) {
      console.error('Database error when saving analysis:', dbError);
      // Continue to return the analysis even if DB save fails
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