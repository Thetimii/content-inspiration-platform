import { NextResponse } from 'next/server';
import axios from 'axios';
import { supabase } from '@/utils/supabase';

/**
 * API endpoint to analyze videos one by one
 * This is called after process-queries to avoid timeouts
 */
export async function POST(request: Request) {
  try {
    const { userId, videoIds } = await request.json();

    if (!userId || !videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
      return NextResponse.json(
        { error: 'User ID and video IDs are required' },
        { status: 400 }
      );
    }

    console.log(`Starting analysis for ${videoIds.length} videos for user ${userId}`);

    // Process the first video immediately and schedule the rest
    const firstVideoId = videoIds[0];
    const remainingVideoIds = videoIds.slice(1);

    // Process the first video
    try {
      await analyzeVideo(firstVideoId);
      console.log(`Analyzed first video: ${firstVideoId}`);
    } catch (error) {
      console.error(`Error analyzing first video ${firstVideoId}:`, error);
    }

    // Schedule the remaining videos to be processed in a separate request
    if (remainingVideoIds.length > 0) {
      try {
        // Use fetch with no-wait to trigger the next video analysis
        fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/analyze-one-by-one`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            videoIds: remainingVideoIds
          })
        }).catch(e => console.error('Error triggering next video analysis:', e));
        
        console.log(`Scheduled analysis for ${remainingVideoIds.length} more videos`);
      } catch (e) {
        console.error('Failed to schedule next video analysis:', e);
      }
    } else {
      // All videos have been analyzed, generate a recommendation
      try {
        console.log('All videos analyzed, generating recommendation...');
        
        // Use fetch with no-wait to trigger recommendation generation
        fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/generate-recommendation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            videoIds
          })
        }).catch(e => console.error('Error triggering recommendation generation:', e));
        
        console.log('Scheduled recommendation generation');
      } catch (e) {
        console.error('Failed to schedule recommendation generation:', e);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Started analysis for video ${firstVideoId}, scheduled ${remainingVideoIds.length} more`
    });
  } catch (error: any) {
    console.error('Error in analyze-one-by-one API route:', error);

    return NextResponse.json(
      {
        error: error.message || 'An error occurred during video analysis',
        suggestion: 'Please try again later or contact support if the issue persists.'
      },
      { status: 500 }
    );
  }
}

// Function to analyze a single video
async function analyzeVideo(videoId: string) {
  try {
    // Get the video URL and download URL
    const { data: videoData, error: videoError } = await supabase
      .from('tiktok_videos')
      .select('video_url, download_url')
      .eq('id', videoId)
      .single();

    if (videoError) {
      throw new Error(`Error fetching video ${videoId}: ${videoError.message}`);
    }

    // Set a flag in the database to indicate analysis is in progress
    await supabase
      .from('tiktok_videos')
      .update({ summary: 'Analysis in progress...' })
      .eq('id', videoId);

    // Use download_url if available, otherwise fall back to video_url
    const urlToAnalyze = videoData.download_url || videoData.video_url;
    console.log(`Using URL for analysis: ${urlToAnalyze}`);

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

    // Make the API call to OpenRouter using the Qwen 2.5 VL model
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'qwen/qwen-2.5-vl-72b-instruct', // Multimodal model that can analyze images
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
                  url: urlToAnalyze
                }
              }
            ]
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${sanitizedApiKey}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          'X-Title': 'Lazy Trends',
          'Content-Type': 'application/json'
        },
        timeout: 120000 // 120 seconds timeout for video processing
      }
    );

    // Extract the analysis from the response
    let analysis = response.data.choices[0]?.message?.content || 'No analysis available';
    console.log('Analysis summary:', analysis.substring(0, 100) + '...');

    // Update the video with the analysis results
    const { error: updateError } = await supabase
      .from('tiktok_videos')
      .update({
        summary: analysis,
        last_analyzed_at: new Date().toISOString()
      })
      .eq('id', videoId);

    if (updateError) {
      throw new Error(`Error updating video ${videoId} with analysis: ${updateError.message}`);
    }

    console.log(`Video ${videoId} analysis completed and saved successfully`);
    return true;
  } catch (error: any) {
    console.error(`Error analyzing video ${videoId}:`, error.message);
    
    // Update the database with an error message
    try {
      await supabase
        .from('tiktok_videos')
        .update({
          summary: `Error analyzing video: ${error.message}`,
          last_analyzed_at: new Date().toISOString()
        })
        .eq('id', videoId);
    } catch (updateError) {
      console.error(`Error updating video ${videoId} with error message:`, updateError);
    }
    
    throw error;
  }
}
