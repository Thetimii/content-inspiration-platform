import { NextResponse } from 'next/server';

/**
 * Edge Function for video analysis
 * This endpoint uses the Edge runtime which has a 30 second timeout instead of 10 seconds
 */
export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    const { videoId, userId, videoUrl } = await request.json();

    if (!videoId || !userId || !videoUrl) {
      return NextResponse.json(
        { error: 'Video ID, user ID, and video URL are required' },
        { status: 400 }
      );
    }

    console.log(`[EDGE-ANALYSIS] Starting analysis for video ${videoId} and user ${userId}`);
    console.log(`[EDGE-ANALYSIS] Using video URL: ${videoUrl}`);

    // Get the DashScope API key
    const dashscopeApiKey = process.env.DASHSCOPE_API_KEY;
    
    if (!dashscopeApiKey) {
      return NextResponse.json(
        { error: 'DashScope API key is missing' },
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

    // Prepare the request payload for DashScope API
    const requestBody = {
      model: 'qwen-vl-max',
      input: {
        messages: [
          { 
            role: "system", 
            content: [{ text: "You are a helpful assistant that analyzes video content." }] 
          },
          {
            role: "user",
            content: [
              { video: videoUrl, fps: 2 },
              { text: prompt }
            ]
          }
        ]
      }
    };

    console.log('[EDGE-ANALYSIS] Making API call to DashScope');
    
    // Make the API call to DashScope
    const response = await fetch('https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${dashscopeApiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json({
        error: 'DashScope API returned an error',
        details: {
          status: response.status,
          data: errorData
        }
      }, { status: 500 });
    }

    const data = await response.json();
    
    // Extract the analysis from the response
    const analysis = data?.output?.text || '';

    if (!analysis || analysis.length < 10) {
      return NextResponse.json({
        error: 'Empty or too short analysis received',
        details: data
      }, { status: 500 });
    }

    console.log('[EDGE-ANALYSIS] Analysis received, length:', analysis.length);
    
    // We can't update the database directly from an Edge Function
    // So we'll return the analysis and let the client update the database
    return NextResponse.json({
      success: true,
      videoId,
      analysis,
      message: 'Analysis completed successfully. Please update the database with this analysis.'
    });

  } catch (error: any) {
    console.error('[EDGE-ANALYSIS] Error:', error.message);

    return NextResponse.json({
      error: error.message || 'An unexpected error occurred',
      details: error.stack || 'No stack trace available'
    }, { status: 500 });
  }
}
