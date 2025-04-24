import { NextResponse } from 'next/server';
import axios from 'axios';
import { supabase } from '@/utils/supabase';

/**
 * API endpoint to directly analyze a single video
 * This version uses the more powerful qwen-2.5-vl-72b-instruct model with a structured prompt
 * and NO fallbacks as requested
 */
export async function POST(request: Request) {
  try {
    const { userId, videoId } = await request.json();

    if (!userId || !videoId) {
      return NextResponse.json(
        { error: 'User ID and video ID are required' },
        { status: 400 }
      );
    }

    console.log(`Directly analyzing video ${videoId} for user ${userId}`);

    // Get the video from the database
    const { data: video, error: videoError } = await supabase
      .from('tiktok_videos')
      .select('*')
      .eq('id', videoId)
      .single();

    if (videoError) {
      console.error('Error fetching video:', videoError);
      return NextResponse.json(
        { error: 'Error fetching video' },
        { status: 500 }
      );
    }

    if (!video) {
      console.error('No video found with the provided ID');
      return NextResponse.json(
        { error: 'No video found with the provided ID' },
        { status: 404 }
      );
    }

    // Check if the video already has analysis
    if (video.frame_analysis) {
      console.log(`Video ${videoId} already has analysis, skipping`);
      return NextResponse.json({
        success: true,
        message: 'Video already has analysis',
        video
      });
    }

    // Make sure we have a download URL
    if (!video.download_url) {
      console.error(`Video ${videoId} has no download URL`);
      return NextResponse.json(
        { error: 'No download URL available for this video' },
        { status: 400 }
      );
    }

    // Get the OpenRouter API key
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error('OpenRouter API key is missing');
      return NextResponse.json(
        { error: 'OpenRouter API key is missing' },
        { status: 500 }
      );
    }

    // Sanitize the API key
    const sanitizedApiKey = apiKey.trim();

    console.log(`Using download URL: ${video.download_url}`);

    // Prepare a more structured prompt for better analysis
    const prompt = `Analyze this TikTok video in detail. Please provide:
1. A comprehensive summary of what's happening in the video
2. Key visual elements and objects present
3. Any text or captions visible in the video
4. The overall theme or message of the content
5. What makes this content engaging or trending

Be specific and detailed in your analysis.`;

    // Make the API call to OpenRouter for video analysis
    console.log(`Calling OpenRouter API for video ${videoId} using anthropic/claude-3-5-sonnet model`);
    console.log(`API Key length: ${sanitizedApiKey.length} characters`);
    console.log(`Download URL: ${video.download_url}`);

    // Prepare the request payload
    const requestPayload = {
      model: 'anthropic/claude-3-5-sonnet', // Using Claude 3.5 Sonnet which has excellent multimodal capabilities
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
                url: video.download_url
              }
            }
          ]
        }
      ]
    };

    console.log('Request payload:', JSON.stringify(requestPayload, null, 2));

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      requestPayload,
      {
        headers: {
          'Authorization': `Bearer ${sanitizedApiKey}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://lazy-trends.vercel.app',
          'X-Title': 'Lazy Trends',
          'Content-Type': 'application/json'
        },
        timeout: 120000 // 120 second timeout to give more time for analysis
      }
    );

    console.log('OpenRouter API response status:', response.status);
    console.log('OpenRouter API response headers:', JSON.stringify(response.headers, null, 2));
    console.log('OpenRouter API response data:', JSON.stringify(response.data, null, 2));

    // Extract the analysis from the response
    const analysis = response.data?.choices?.[0]?.message?.content || '';
    console.log(`Received analysis for video ${videoId}, length: ${analysis.length} characters`);

    // Check if we actually got a meaningful analysis
    if (!analysis || analysis.trim().length < 10) {
      console.error(`Empty or too short analysis received for video ${videoId}`);
      return NextResponse.json(
        {
          error: 'The API returned an empty or too short analysis',
          suggestion: 'This may be due to the model being unable to process the video properly. Please try again later.'
        },
        { status: 500 }
      );
    }

    // Update the video in the database with the analysis
    const { data: updatedVideo, error: updateError } = await supabase
      .from('tiktok_videos')
      .update({
        frame_analysis: analysis,
        summary: analysis.substring(0, 500) + (analysis.length > 500 ? '...' : ''),
        last_analyzed_at: new Date().toISOString()
      })
      .eq('id', videoId)
      .select();

    if (updateError) {
      console.error(`Error updating video ${videoId}:`, updateError);
      return NextResponse.json(
        { error: `Error updating video: ${updateError.message}` },
        { status: 500 }
      );
    }

    console.log(`Successfully updated video ${videoId} with analysis`);

    return NextResponse.json({
      success: true,
      message: 'Video analyzed successfully',
      video: updatedVideo[0],
      analysis
    });
  } catch (error: any) {
    console.error('Error in direct-analyze API route:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      responseStatus: error.response?.status,
      responseData: error.response?.data ? JSON.stringify(error.response.data).substring(0, 200) : 'No response data'
    });

    return NextResponse.json(
      {
        error: error.message || 'An error occurred during video analysis',
        suggestion: 'Please try again later or contact support if the issue persists.'
      },
      { status: 500 }
    );
  }
}
