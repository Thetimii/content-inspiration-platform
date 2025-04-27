import { NextResponse } from 'next/server';
import axios from 'axios';

/**
 * Test endpoint for DashScope API
 * This is a simple endpoint that makes a direct call to the DashScope API
 * and returns the result without any background processing
 */
export async function POST(request: Request) {
  try {
    const { videoUrl } = await request.json();

    if (!videoUrl) {
      return NextResponse.json(
        { error: 'Video URL is required' },
        { status: 400 }
      );
    }

    console.log('[TEST-DASHSCOPE] Testing DashScope API with video URL:', videoUrl);

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

    // Prepare the request payload for DashScope API using the exact format from the video analyzer project
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
      'Authorization': `Bearer ${dashscopeApiKey}`
    };

    console.log('[TEST-DASHSCOPE] Making API call to DashScope');

    // Make the API call to DashScope
    const response = await axios.post(
      'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
      requestBody,
      {
        headers,
        timeout: 60000 // 1 minute timeout
      }
    );

    console.log('[TEST-DASHSCOPE] Received response from DashScope API');
    console.log('[TEST-DASHSCOPE] Response status:', response.status);

    // Return the full response for debugging
    return NextResponse.json({
      success: true,
      response: {
        status: response.status,
        data: response.data,
        output: response.data?.output?.text || null
      }
    });

  } catch (error: any) {
    console.error('[TEST-DASHSCOPE] Error:', error.message);

    // Return detailed error information
    const errorResponse = {
      error: error.message,
      details: {}
    };

    if (error.response) {
      errorResponse.details = {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers
      };
    } else if (error.request) {
      errorResponse.details = {
        request: 'Request was made but no response was received'
      };
    }

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
