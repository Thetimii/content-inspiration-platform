import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';

/**
 * Non-blocking endpoint that starts the analysis process and returns immediately
 * This avoids timeouts while still using the original direct approach
 */
export async function POST(request: Request) {
  try {
    const { videoId } = await request.json();

    if (!videoId) {
      return NextResponse.json(
        { error: 'Video ID is required' },
        { status: 400 }
      );
    }

    // Get the video URL from the database
    const { data: videoData, error: videoError } = await supabase
      .from('tiktok_videos')
      .select('download_url, video_url')
      .eq('id', videoId)
      .single();

    if (videoError) {
      console.error('Error fetching video data:', videoError);
      return NextResponse.json(
        { error: 'Failed to fetch video data' },
        { status: 500 }
      );
    }

    // Use download_url if available, otherwise fall back to video_url
    const urlToAnalyze = videoData.download_url || videoData.video_url;

    if (!urlToAnalyze) {
      console.error('No URL found for video:', videoId);
      return NextResponse.json(
        { error: 'No URL available for this video' },
        { status: 400 }
      );
    }

    console.log(`Starting analysis for video ${videoId} with URL: ${urlToAnalyze}`);

    // Set a flag in the database to indicate analysis is in progress
    await supabase
      .from('tiktok_videos')
      .update({ summary: 'Analysis in progress...' })
      .eq('id', videoId);

    // Start the analysis process in the background
    // This is a non-blocking call that will continue even after this function returns
    startAnalysisInBackground(videoId, urlToAnalyze);

    // Return immediately to avoid timeouts
    return NextResponse.json({
      success: true,
      message: 'Analysis started in the background',
      videoId
    });
  } catch (error: any) {
    console.error('Error starting video analysis:', error);

    return NextResponse.json(
      {
        error: error.message || 'An error occurred while starting video analysis',
        suggestion: 'Please try again later or contact support if the issue persists.'
      },
      { status: 500 }
    );
  }
}

// Function to start the analysis process in the background
async function startAnalysisInBackground(videoId: string, videoUrl: string) {
  try {
    // Import required modules
    const axios = await import('axios');

    console.log(`Background analysis started for video ${videoId}`);
    console.log(`Video URL: ${videoUrl}`);

    // Prepare the prompt for the multimodal model
    const prompt = `Analyze this TikTok video in detail. Please provide:
1. A comprehensive summary of what's happening in the video
2. Key visual elements and objects present
3. Any text or captions visible in the video
4. The overall theme or message of the content
5. What makes this content engaging or trending

Be specific and detailed in your analysis.`;

    // Get and sanitize the API key
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OpenRouter API key is missing');
    }

    // Sanitize the API key - remove any whitespace or invalid characters
    const sanitizedApiKey = apiKey.trim();
    console.log(`API key length: ${apiKey.length}, sanitized length: ${sanitizedApiKey.length}`);
    console.log(`First 5 chars of sanitized key: ${sanitizedApiKey.substring(0, 5)}...`);

    console.log(`Making API call to OpenRouter for video ${videoId}...`);

    // Make the API call to OpenRouter using the free Qwen 2.5 VL model
    const response = await axios.default.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'qwen/qwen2.5-vl-32b-instruct:free', // Free multimodal model
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: videoUrl
                }
              }
            ]
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${sanitizedApiKey}`,
          'HTTP-Referer': 'https://www.lazy-trends.com',
          'X-Title': 'Lazy Trends',
          'Content-Type': 'application/json'
        },
        timeout: 120000 // 120 seconds timeout for video processing
      }
    );

    console.log(`Received response from OpenRouter for video ${videoId}`);
    console.log('Response status:', response.status);
    console.log('Response data structure:', JSON.stringify({
      id: response.data.id,
      model: response.data.model,
      choices: response.data.choices ? [{
        index: response.data.choices[0]?.index,
        message: {
          role: response.data.choices[0]?.message?.role,
          content_length: response.data.choices[0]?.message?.content?.length || 0
        }
      }] : 'No choices'
    }));

    // Extract the analysis from the response
    const analysis = response.data.choices[0]?.message?.content || 'No analysis available';
    console.log('Analysis preview:', analysis.substring(0, 100) + '...');

    console.log(`Updating database with analysis for video ${videoId}`);

    // Update the video with the analysis
    await supabase
      .from('tiktok_videos')
      .update({
        summary: analysis,
        last_analyzed_at: new Date().toISOString()
      })
      .eq('id', videoId);

    console.log(`Analysis completed successfully for video ${videoId}`);
  } catch (error: any) {
    console.error(`Error in background analysis for video ${videoId}:`, error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      responseStatus: error.response?.status,
      responseData: error.response?.data ? JSON.stringify(error.response.data).substring(0, 200) : 'No response data'
    });

    // Update the database with an error message
    try {
      await supabase
        .from('tiktok_videos')
        .update({
          summary: `Error analyzing video: ${error.message}`,
          last_analyzed_at: new Date().toISOString()
        })
        .eq('id', videoId);

      console.log(`Updated video ${videoId} with error message`);
    } catch (updateError) {
      console.error(`Error updating video ${videoId} with error message:`, updateError);
    }
  }
}
