import { NextResponse } from 'next/server';
import axios from 'axios';

/**
 * Test endpoint for DashScope API using Edge Runtime
 * Edge functions can run for up to 30 seconds instead of 10 seconds
 */
export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    const { videoUrl } = await request.json();

    if (!videoUrl) {
      return NextResponse.json(
        { error: 'Video URL is required' },
        { status: 400 }
      );
    }

    console.log('[EDGE-TEST] Testing DashScope API with video URL:', videoUrl);

    // Get the DashScope API key
    const dashscopeApiKey = process.env.DASHSCOPE_API_KEY;
    
    if (!dashscopeApiKey) {
      return NextResponse.json(
        { error: 'DashScope API key is missing' },
        { status: 500 }
      );
    }

    // Prepare the prompt for video analysis
    const prompt = `Please analyze this video and describe what's happening in it.`;

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

    return NextResponse.json({
      success: true,
      response: {
        status: response.status,
        data: data,
        output: analysis
      }
    });

  } catch (error: any) {
    console.error('[EDGE-TEST] Error:', error.message);

    return NextResponse.json({
      error: error.message || 'An unexpected error occurred',
      details: error.stack || 'No stack trace available'
    }, { status: 500 });
  }
}
