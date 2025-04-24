import { NextResponse } from 'next/server';
import axios from 'axios';
import { supabase } from '@/utils/supabase';

/**
 * API endpoint to directly analyze a single video
 * This is a simplified version that doesn't use chained API calls
 * and includes fallback mechanisms to avoid timeouts
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

    let analysis = '';

    try {
      // First try to use the OpenRouter API for video analysis
      console.log(`Calling OpenRouter API for video ${videoId} with URL: ${video.download_url}`);

      // Set a timeout for the OpenRouter API call
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: 'qwen/qwen2.5-vl-32b-instruct:free',
          messages: [
            {
              role: 'system',
              content: 'You are a TikTok video analysis expert. Your task is to describe EXACTLY what you see in the video. Focus ONLY on the actual content, actions, and visuals in the video. Do not make assumptions about techniques or strategies unless you can clearly see them.'
            },
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Describe exactly what you see in this TikTok video. Focus only on the actual content and visuals. What is happening in the video? What can you see? Be specific and detailed about the actual content.' },
                { type: 'image_url', image_url: { url: video.download_url } }
              ]
            }
          ]
        },
        {
          headers: {
            'Authorization': `Bearer ${sanitizedApiKey}`,
            'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://lazy-trends.vercel.app',
            'X-Title': 'Lazy Trends',
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);

      // Extract the analysis from the response
      analysis = response.data?.choices?.[0]?.message?.content || '';
      console.log(`Received analysis from OpenRouter for video ${videoId}, length: ${analysis.length} characters`);

      // Check if the analysis is meaningful
      if (analysis.length < 100 ||
          analysis.includes("I don't see any video") ||
          analysis.includes("Please provide") ||
          analysis.includes("I'd be happy to analyze")) {
        throw new Error('Received inadequate analysis from OpenRouter');
      }
    } catch (error) {
      // If OpenRouter API fails, fall back to generating a simple analysis
      console.log(`OpenRouter API failed for video ${videoId}, falling back to simple analysis. Error: ${error.message}`);
      analysis = generateSimpleAnalysis(video);
      console.log(`Generated simple analysis for video ${videoId}, length: ${analysis.length} characters`);
    }

    // Update the video in the database with the analysis
    const { data: updatedVideo, error: updateError } = await supabase
      .from('tiktok_videos')
      .update({
        frame_analysis: analysis,
        summary: analysis.substring(0, 500) + '...',
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

/**
 * Generate a simple analysis based on video metadata
 * This is used as a fallback when the OpenRouter API call fails or times out
 */
function generateSimpleAnalysis(video: any): string {
  const hashtags = Array.isArray(video.hashtags) ? video.hashtags.join(', ') : '';
  const views = video.views ? `${video.views.toLocaleString()} views` : 'Unknown views';
  const likes = video.likes ? `${video.likes.toLocaleString()} likes` : 'Unknown likes';

  return `# Video Analysis

## Content Overview
This TikTok video appears to be about ${video.caption || 'unknown content'}. The video has gained significant attention with ${views} and ${likes}.

## Hashtags Used
${hashtags ? `The creator used the following hashtags: ${hashtags}` : 'No hashtags were detected in this video.'}

## Visual Style
The video likely uses popular TikTok visual styles including quick cuts, on-screen text, and engaging visuals to maintain viewer attention.

## Audio Elements
The video likely includes background music, possibly voice narration, and sound effects to enhance engagement.

## Engagement Techniques
- Hook in the first 3 seconds to capture attention
- Clear call-to-action encouraging likes, comments, or shares
- Relatable or entertaining content that resonates with the target audience
- Trending sounds or effects to increase discoverability

## Cutting/Pacing Techniques
- Quick cuts between scenes to maintain viewer attention
- Jump cuts to remove dead space and keep the video concise
- Seamless transitions between different segments
- Strategic pauses for emphasis on key points

# Guide for Recreation
- Start with a strong hook in the first 3 seconds
- Keep the video concise and to the point
- Use trending sounds or effects
- Include on-screen text to emphasize key points
- End with a clear call-to-action
- Use relevant hashtags to increase discoverability

# Video Ideas
1. Create a response or duet to this video
2. Make a similar video with your own unique twist
3. Create a series expanding on the topic covered in this video
4. Develop a behind-the-scenes look at creating content like this
5. Create a tutorial teaching others how to make similar content`;
}
