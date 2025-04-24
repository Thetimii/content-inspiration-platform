import { NextResponse } from 'next/server';
import axios from 'axios';
import { supabase } from '@/utils/supabase';

/**
 * API endpoint to directly analyze a single video
 * This version passes a clean, no-watermark video URL to the OpenRouter API
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

    console.log(`Analyzing video ${videoId} for user ${userId}`);

    // Get the video from the database
    const { data: video, error: videoError } = await supabase
      .from('tiktok_videos')
      .select('*')
      .eq('id', videoId)
      .single();

    if (videoError || !video) {
      console.error('Error fetching video:', videoError);
      return NextResponse.json(
        { error: 'Error fetching video or video not found' },
        { status: 404 }
      );
    }

    // Check if the video already has analysis
    if (video.frame_analysis) {
      console.log(`Video ${videoId} already has analysis, returning existing analysis`);
      return NextResponse.json({
        success: true,
        message: 'Video already has analysis',
        video,
        analysis: video.frame_analysis
      });
    }

    // Make sure we have a video URL
    if (!video.video_url) {
      return NextResponse.json(
        { error: 'No video URL available for this video' },
        { status: 400 }
      );
    }

    // Get the RapidAPI key
    const rapidApiKey = process.env.RAPIDAPI_KEY;
    if (!rapidApiKey) {
      return NextResponse.json(
        { error: 'RapidAPI key is missing' },
        { status: 500 }
      );
    }

    // Step 1: Get a clean, no-watermark download URL from RapidAPI
    console.log(`Getting clean download URL for video: ${video.video_url}`);
    
    let downloadUrl = '';
    try {
      const rapidApiResponse = await axios.get(
        'https://tiktok-download-video1.p.rapidapi.com/getVideo',
        {
          params: {
            url: video.video_url,
            hd: '1'
          },
          headers: {
            'X-RapidAPI-Key': rapidApiKey,
            'X-RapidAPI-Host': 'tiktok-download-video1.p.rapidapi.com'
          }
        }
      );
      
      console.log('RapidAPI response received');
      
      // Extract the download URL from the response
      if (rapidApiResponse.data && rapidApiResponse.data.data && rapidApiResponse.data.data.play) {
        downloadUrl = rapidApiResponse.data.data.play;
        console.log(`Got clean download URL: ${downloadUrl}`);
        
        // Update the video record with the download URL
        await supabase
          .from('tiktok_videos')
          .update({ download_url: downloadUrl })
          .eq('id', videoId);
      } else {
        console.error('Could not extract download URL from RapidAPI response');
        console.error('Response:', JSON.stringify(rapidApiResponse.data, null, 2));
        
        // Fall back to the existing download_url or video_url
        downloadUrl = video.download_url || video.video_url;
        console.log(`Falling back to: ${downloadUrl}`);
      }
    } catch (error) {
      console.error('Error getting clean download URL:', error);
      downloadUrl = video.download_url || video.video_url;
      console.log(`Error occurred, falling back to: ${downloadUrl}`);
    }
    
    if (!downloadUrl) {
      return NextResponse.json(
        { error: 'Could not get a valid download URL for the video' },
        { status: 500 }
      );
    }

    // Step 2: Analyze the video using OpenRouter API
    console.log(`Analyzing video using OpenRouter API: ${downloadUrl}`);
    
    // Get the OpenRouter API key
    const openRouterApiKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterApiKey) {
      return NextResponse.json(
        { error: 'OpenRouter API key is missing' },
        { status: 500 }
      );
    }

    // Prepare the prompt for video analysis
    const prompt = `Analyze this TikTok video in detail. Please provide:
1. A comprehensive summary of what's happening in the video
2. Key visual elements and objects present
3. Any text or captions visible in the video
4. The overall theme or message of the content
5. What makes this content engaging or trending

Be specific and detailed in your analysis.`;

    try {
      const openRouterResponse = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: 'qwen/qwen-2.5-vl-72b-instruct',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: downloadUrl } }
              ]
            }
          ]
        },
        {
          headers: {
            'Authorization': `Bearer ${openRouterApiKey.trim()}`,
            'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://lazy-trends.vercel.app',
            'X-Title': 'Lazy Trends',
            'Content-Type': 'application/json'
          },
          timeout: 120000 // 2 minute timeout
        }
      );
      
      console.log('OpenRouter API response received');
      
      // Extract the analysis from the response
      const analysis = openRouterResponse.data?.choices?.[0]?.message?.content || '';
      
      if (!analysis || analysis.length < 10) {
        console.error('Empty or too short analysis received');
        return NextResponse.json(
          { error: 'The AI model returned an empty or too short analysis' },
          { status: 500 }
        );
      }
      
      console.log(`Analysis received, length: ${analysis.length} characters`);
      
      // Update the video with the analysis
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
        console.error('Error updating video with analysis:', updateError);
        return NextResponse.json(
          { error: 'Error saving analysis to database' },
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
    } catch (error) {
      console.error('Error analyzing video with OpenRouter:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      
      return NextResponse.json(
        { 
          error: 'Error analyzing video with AI',
          details: error.message
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Unexpected error in direct-analyze-new route:', error);
    
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
