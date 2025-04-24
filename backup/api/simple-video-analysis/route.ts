import { NextResponse } from 'next/server';
import axios from 'axios';
import { supabase } from '@/utils/supabase';

/**
 * Simple endpoint to analyze a video with OpenRouter
 * Takes a video ID, gets the downloadable URL, sends it to OpenRouter, and returns the description
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
      return NextResponse.json(
        { error: 'No URL available for this video' },
        { status: 400 }
      );
    }

    console.log(`Analyzing video URL: ${urlToAnalyze}`);

    // Set a flag in the database to indicate analysis is in progress
    await supabase
      .from('tiktok_videos')
      .update({ summary: 'Analysis in progress...' })
      .eq('id', videoId);

    // Get the OpenRouter API key
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenRouter API key is missing' },
        { status: 500 }
      );
    }

    // Sanitize the API key
    const sanitizedApiKey = apiKey.trim();

    // Make the API call to OpenRouter using the free Qwen 2.5 VL model
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'qwen/qwen2.5-vl-32b-instruct:free',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this TikTok video in detail. Please provide:
1. A comprehensive summary of what's happening in the video
2. Key visual elements and objects present
3. Any text or captions visible in the video
4. The overall theme or message of the content
5. What makes this content engaging or trending

Be specific and detailed in your analysis.`
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
    const analysis = response.data.choices[0]?.message?.content || 'No analysis available';

    // Update the video with the analysis
    await supabase
      .from('tiktok_videos')
      .update({
        summary: analysis,
        last_analyzed_at: new Date().toISOString()
      })
      .eq('id', videoId);

    return NextResponse.json({
      success: true,
      analysis
    });
  } catch (error: any) {
    console.error('Error analyzing video:', error);

    // Update the database with an error message
    try {
      const { videoId } = await request.json();
      if (videoId) {
        await supabase
          .from('tiktok_videos')
          .update({
            summary: `Error analyzing video: ${error.message}`,
            last_analyzed_at: new Date().toISOString()
          })
          .eq('id', videoId);
      }
    } catch (updateError) {
      console.error('Error updating video with error message:', updateError);
    }

    return NextResponse.json(
      {
        error: error.message || 'An error occurred during video analysis',
        suggestion: 'Please try again later or contact support if the issue persists.'
      },
      { status: 500 }
    );
  }
}
