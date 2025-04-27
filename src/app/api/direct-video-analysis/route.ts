import { NextResponse } from 'next/server';
import axios from 'axios';
import { supabase } from '@/utils/supabase';

/**
 * API endpoint to analyze a TikTok video using Alibaba Cloud DashScope API
 * This implementation follows the exact approach from the video analyzer project
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

    console.log(`[DIRECT-ANALYSIS] Starting analysis for video ${videoId} and user ${userId}`);

    // Get the video from the database
    const { data: video, error: videoError } = await supabase
      .from('tiktok_videos')
      .select('*')
      .eq('id', videoId)
      .single();

    if (videoError || !video) {
      console.error(`[DIRECT-ANALYSIS] Error fetching video ${videoId}:`, videoError);
      return NextResponse.json(
        { error: 'Error fetching video or video not found' },
        { status: 404 }
      );
    }

    // Check if the video already has analysis
    if (video.frame_analysis && video.frame_analysis !== 'Analysis in progress...') {
      console.log(`[DIRECT-ANALYSIS] Video ${videoId} already has analysis, returning existing analysis`);
      return NextResponse.json({
        success: true,
        message: 'Video already has analysis',
        video,
        analysis: video.frame_analysis
      });
    }

    // Make sure we have a video URL
    if (!video.video_url && !video.download_url) {
      console.error(`[DIRECT-ANALYSIS] No video URL available for video ${videoId}`);
      return NextResponse.json(
        { error: 'No video URL available for this video' },
        { status: 400 }
      );
    }

    // Update the video status to indicate analysis is in progress
    const { error: updateError } = await supabase
      .from('tiktok_videos')
      .update({
        frame_analysis: 'Analysis in progress...',
        last_analyzed_at: new Date().toISOString()
      })
      .eq('id', videoId);
      
    if (updateError) {
      console.error(`[DIRECT-ANALYSIS] Error updating video ${videoId} status:`, updateError);
      return NextResponse.json(
        { error: 'Error updating video status' },
        { status: 500 }
      );
    }

    // Start the analysis process in the background without waiting for it to complete
    // This prevents Vercel's 10-second timeout from being triggered
    analyzeVideoInBackground(videoId, video.download_url || video.video_url);
    
    // Return a response immediately
    return NextResponse.json({
      success: true,
      message: 'Video analysis started',
      video_id: videoId,
      status: 'processing'
    });
    
  } catch (error: any) {
    console.error('[DIRECT-ANALYSIS] Unexpected error:', error);
    
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Analyze a video in the background and update the database when complete
 * This implementation follows the exact approach from the video analyzer project
 */
async function analyzeVideoInBackground(videoId: string, videoUrl: string) {
  try {
    console.log(`[DIRECT-ANALYSIS] Starting background analysis for video ${videoId}`);
    console.log(`[DIRECT-ANALYSIS] Using video URL: ${videoUrl}`);

    // Get the DashScope API key
    const dashscopeApiKey = process.env.DASHSCOPE_API_KEY;
    console.log(`[DIRECT-ANALYSIS] DashScope API key available: ${dashscopeApiKey ? 'Yes' : 'No'}`);
    console.log(`[DIRECT-ANALYSIS] DashScope API key length: ${dashscopeApiKey?.length || 0}`);
    
    if (!dashscopeApiKey) {
      console.error('[DIRECT-ANALYSIS] DashScope API key is missing');
      await updateVideoWithError(videoId, 'DashScope API key is missing');
      return;
    }
    
    // Log the first few characters of the API key for debugging (don't log the full key)
    if (dashscopeApiKey.length > 8) {
      console.log(`[DIRECT-ANALYSIS] DashScope API key prefix: ${dashscopeApiKey.substring(0, 4)}...${dashscopeApiKey.substring(dashscopeApiKey.length - 4)}`);
    }

    // Prepare the prompt for video analysis
    const prompt = `Analyze this TikTok video in detail. Please provide:
1. A comprehensive summary of what's happening in the video
2. Key visual elements and objects present
3. Any text or captions visible in the video
4. The overall theme or message of the content
5. What makes this content engaging or trending

Be specific and detailed in your analysis.`;

    // Prepare the request payload for DashScope API using the exact format from the video analyzer project
    const requestBody = {
      model: 'qwen-vl-max',
      input: {
        messages: [
          { 
            role: "system", 
            content: [{ text: "You are a helpful assistant that analyzes TikTok videos in detail." }] 
          },
          {
            role: "user",
            content: [
              { video: videoUrl, fps: 2 }, // Use fps: 2 to extract frames at 2 frames per second
              { text: prompt }
            ]
          }
        ]
      }
    };
    
    // Prepare the headers
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${dashscopeApiKey.trim()}`
    };
    
    console.log('[DIRECT-ANALYSIS] Making API call to DashScope with video URL:', videoUrl);
    
    try {
      // Make the API call to DashScope - using the exact endpoint from the video analyzer project
      const response = await axios.post(
        'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
        requestBody,
        {
          headers,
          timeout: 180000 // 3 minutes timeout for video processing
        }
      );
      
      console.log('[DIRECT-ANALYSIS] Received response from DashScope API');
      console.log('[DIRECT-ANALYSIS] Response status:', response.status);
      console.log('[DIRECT-ANALYSIS] Response data:', JSON.stringify(response.data, null, 2));
      
      // Extract the analysis from the response using the format from the video analyzer project
      const analysis = response.data?.output?.text || '';
      
      if (!analysis || analysis.length < 10) {
        console.error('[DIRECT-ANALYSIS] Empty or too short analysis received');
        await updateVideoWithError(videoId, 'The AI model returned an empty or too short analysis');
        return;
      }
      
      console.log('[DIRECT-ANALYSIS] Analysis received, length:', analysis.length);
      console.log('[DIRECT-ANALYSIS] Analysis preview:', analysis.substring(0, 100) + '...');
      
      // Update the video with the analysis
      const updateData = {
        frame_analysis: analysis,
        summary: analysis.substring(0, 500) + (analysis.length > 500 ? '...' : ''),
        last_analyzed_at: new Date().toISOString()
      };
      
      console.log(`[DIRECT-ANALYSIS] Updating video ${videoId} in database with analysis...`);
      const { error: updateError } = await supabase
        .from('tiktok_videos')
        .update(updateData)
        .eq('id', videoId);
      
      if (updateError) {
        console.error('[DIRECT-ANALYSIS] Error updating video with analysis:', updateError);
        await updateVideoWithError(videoId, `Error updating video: ${updateError.message}`);
        return;
      }
      
      console.log(`[DIRECT-ANALYSIS] Successfully updated video ${videoId} with analysis`);
      
    } catch (error: any) {
      console.error('[DIRECT-ANALYSIS] Error analyzing video with DashScope:', error);
      
      if (error.response) {
        console.error('[DIRECT-ANALYSIS] Response data:', JSON.stringify(error.response.data, null, 2));
        console.error('[DIRECT-ANALYSIS] Response status:', error.response.status);
      } else if (error.request) {
        console.error('[DIRECT-ANALYSIS] No response received from server');
      } else {
        console.error('[DIRECT-ANALYSIS] Error setting up request:', error.message);
      }
      
      await updateVideoWithError(videoId, `Error analyzing video: ${error.message || 'Unknown error'}`);
    }
  } catch (error: any) {
    console.error('[DIRECT-ANALYSIS] Unexpected error in background analysis:', error);
    await updateVideoWithError(videoId, 'An unexpected error occurred during analysis');
  }
}

/**
 * Update a video with an error message
 */
async function updateVideoWithError(videoId: string, errorMessage: string) {
  try {
    console.log(`[DIRECT-ANALYSIS] Updating video ${videoId} with error message: ${errorMessage}`);
    
    const { error } = await supabase
      .from('tiktok_videos')
      .update({
        frame_analysis: `Analysis failed: ${errorMessage}`,
        last_analyzed_at: new Date().toISOString()
      })
      .eq('id', videoId);
    
    if (error) {
      console.error(`[DIRECT-ANALYSIS] Error updating video with error message:`, error);
    } else {
      console.log(`[DIRECT-ANALYSIS] Successfully updated video ${videoId} with error message`);
    }
  } catch (error: any) {
    console.error(`[DIRECT-ANALYSIS] Error updating video with error message:`, error);
  }
}
