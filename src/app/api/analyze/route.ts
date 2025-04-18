import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: Request) {
  try {
    const { videoUrl, videoId, userId, searchQuery } = await request.json()
    console.log('Starting video analysis (API call):', { videoUrl, videoId, userId })

    // Optional: Store minimal metadata if needed (removed file details)
    const { error: insertError } = await supabase
      .from('temp_videos')
      .insert({
        user_id: userId,
        video_id: videoId,
        // file_name: `${videoId}.mp4`, // Removed
        // file_data: null, // Removed
        content_type: 'video/mp4', // Kept for consistency, maybe useful later
        video_url_source: videoUrl // Added source URL
      })
      .select('id') // Select ID to confirm insertion if needed
      .single()

    if (insertError) {
      console.warn(`Warning: Failed to store video metadata: ${insertError.message}`)
      // Decide if this failure should stop the process or just be logged
      // Depending on requirements, you might want to return an error here
    } else {
      console.log('Video metadata stored successfully')
    }

    // --- Removed video-analyzer execution ---
    // const outputDir = path.join(process.cwd(), 'output')
    // await fs.mkdir(outputDir, { recursive: true })
    // const analyzer: ChildProcess = spawn(...)
    // analyzer.stderr?.on(...)
    // await new Promise(...)
    // const analysisFilePath = path.join(outputDir, 'analysis.json')
    // ... read file logic ...

    // --- Added Direct Together AI API Call ---

    if (!process.env.TOGETHER_API_KEY) {
      throw new Error('Together API key is not configured')
    }

    // Construct the prompt for the text-based model
    // Include the video URL for context, although the model cannot "watch" it directly
    const prompt = `Analyze the likely content and style of this TikTok video based on its URL and context: ${videoUrl}. Provide insights about: 
1. Potential main activities shown (infer based on typical content associated with similar URLs if possible)
2. Likely visual elements and equipment (generic suggestions for TikTok)
3. Common style and techniques in this niche
4. Target audience inference
5. Key tips for creating similar content. 
Keep the analysis concise and actionable. Note: Direct video access is not available; infer based on context and general TikTok knowledge.`

    let analysisText = ''

    try {
      const response = await fetch('https://api.together.xyz/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free', // Using the same model as analyze-patterns for consistency
          messages: [
            {
              role: 'system',
              content: 'You are a social media content analyst. You are analyzing a TikTok video based only on its URL and a user prompt. Infer the content and provide actionable advice for recreation.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 1500, // Adjusted token limit
          top_p: 0.9,
          frequency_penalty: 0.3,
          presence_penalty: 0.3
        })
      })

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`Together AI API error: ${response.status}`, errorBody);
        // Fallback or specific error handling
        analysisText = `Error: Could not analyze video via API (${response.status}). ${errorBody}`;
        // Decide if you want to save this error state to Supabase or throw
        // For now, we'll save the error message as the analysis result.
      } else {
        const result = await response.json();
        if (result.choices && result.choices[0] && result.choices[0].message) {
          analysisText = result.choices[0].message.content;
          console.log('Successfully received analysis from API');
        } else {
          console.error('Unexpected API response format:', JSON.stringify(result, null, 2));
          analysisText = 'Error: Received unexpected format from analysis API.';
        }
      }
    } catch (apiError) {
      console.error('Error calling Together AI API:', apiError);
      analysisText = `Error: Failed to call analysis API. ${apiError instanceof Error ? apiError.message : String(apiError)}`;
      // Decide if you want to save this error state to Supabase or throw
    }
    
    // --- End Direct Together AI API Call ---


    // Save the analysis (or error message) to Supabase
    console.log('Saving analysis to Supabase for video ID:', videoId)
    console.log('Analysis text to save:', analysisText) // Log the actual text being saved

    const { error: saveError } = await supabase
      .from('video_analysis')
      .upsert({
        user_id: userId,
        video_id: videoId,
        search_query: searchQuery || '',
        analysis_result: analysisText, // Save the obtained text or error message
        status: analysisText.startsWith('Error:') ? 'failed' : 'completed', // Set status based on result
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })

    if (saveError) {
      console.error('Error saving analysis to Supabase:', saveError)
      // Even if saving fails, we might have a valid analysisText from the API
      // Return the analysisText but maybe with a different status or error indication?
      // For now, return the API result but log the DB error server-side.
      // Client needs to be aware that saving might have failed.
      return NextResponse.json({
        success: !analysisText.startsWith('Error:'), // Success based on API call, not DB save
        result: analysisText,
        warning: `Database error: ${saveError.message}` // Add warning
      }, { status: analysisText.startsWith('Error:') ? 500 : 200 }) // Return 500 if API failed
    }

    // --- Removed file cleanup ---
    // try {
    //   await fs.unlink(analysisFilePath)
    //   console.log('Cleaned up analysis file')
    // } catch (error) {
    //   console.warn('Warning: Could not clean up analysis file:', error)
    // }

    return NextResponse.json({
      success: !analysisText.startsWith('Error:'),
      result: analysisText
    })
  } catch (error) {
    console.error('Error in video analysis route:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 })
  }
} 