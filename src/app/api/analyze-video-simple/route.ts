import { NextResponse } from 'next/server';
import axios from 'axios';
import { supabase } from '@/utils/supabase';

// Server-side implementation of video analysis using OpenRouter's multimodal model
export async function analyzeVideoWithOpenRouter(videoUrl: string) {
  try {
    console.log(`Starting analysis process for video using OpenRouter multimodal model: ${videoUrl}`);

    // Extract the download URL from the video URL if it's not already a direct download link
    // In our case, the videoUrl should already be the download_url from the TikTok API
    const downloadUrl = videoUrl;
    console.log(`Using download URL for analysis: ${downloadUrl}`);

    // Prepare the prompt for the multimodal model
    const prompt = `Analyze this TikTok video in detail. Please provide:
1. A comprehensive summary of what's happening in the video
2. Key visual elements and objects present
3. Any text or captions visible in the video
4. The overall theme or message of the content
5. What makes this content engaging or trending

Be specific and detailed in your analysis.`;

    console.log('Sending request to OpenRouter multimodal model...');

    // Get and sanitize the API key
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OpenRouter API key is missing');
    }

    // Sanitize the API key - remove any whitespace or invalid characters
    const sanitizedApiKey = apiKey.trim();
    console.log(`API key length: ${apiKey.length}, sanitized length: ${sanitizedApiKey.length}`);
    console.log(`First 5 chars of sanitized key: ${sanitizedApiKey.substring(0, 5)}...`);

    // Make the API call to OpenRouter using the free Qwen 2.5 VL model
    const response = await axios.post(
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
                  url: downloadUrl
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

    console.log('OpenRouter response received');

    // Extract the analysis from the response
    let analysis = response.data.choices[0]?.message?.content || 'No analysis available';
    console.log('Analysis summary:', analysis.substring(0, 100) + '...');

    // Ensure the analysis is a string and not undefined or null
    if (!analysis) {
      analysis = 'No analysis available';
    }

    // Since we're not using the video analyzer service anymore, we won't have a transcript or frame analysis
    // Instead, we'll return the full analysis as the summary
    return {
      summary: analysis,
      transcript: '', // No transcript available with this method
      frames_analysis: [] // No frame analysis available with this method
    };
  } catch (error: any) {
    console.error(`Error analyzing video with OpenRouter: ${videoUrl}`, error.message);
    if (error.response) {
      console.error('Error response status:', error.response.status);
      console.error('Error response data:', error.response.data);
    }

    // In case of API failure, return a basic summary
    // This allows the app to continue functioning even if the API fails
    return {
      summary: `Error analyzing video: ${error.message}`,
      transcript: '',
      frames_analysis: []
    };
  }
}

export async function POST(request: Request) {
  try {
    const { videoId } = await request.json();

    if (!videoId) {
      return NextResponse.json(
        { error: 'Video ID is required' },
        { status: 400 }
      );
    }

    // Get the download URL from the database
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

    // Analyze video using OpenRouter multimodal model
    const analysis = await analyzeVideoWithOpenRouter(urlToAnalyze);

    // Update video with summary
    console.log('Updating video with summary:', videoId);
    console.log('Summary content:', analysis.summary);

    // First, try to update just the summary field and last_analyzed_at timestamp
    const { data, error } = await supabase
      .from('tiktok_videos')
      .update({
        summary: analysis.summary || 'No analysis available',
        last_analyzed_at: new Date().toISOString()
      })
      .eq('id', videoId)
      .select('*');

    // If that succeeded, update the other fields
    if (!error) {
      await supabase
        .from('tiktok_videos')
        .update({
          transcript: analysis.transcript || '',
          frame_analysis: null // No frame analysis with this method
        })
        .eq('id', videoId);
    }

    if (error) {
      console.error('Error updating video with summary:', error);
      return NextResponse.json(
        { error: 'Failed to update video with summary' },
        { status: 500 }
      );
    }

    return NextResponse.json({ video: data[0], analysis });
  } catch (error: any) {
    console.error('Error in analyze-video-simple API route:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred' },
      { status: 500 }
    );
  }
}
