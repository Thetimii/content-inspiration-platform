import { NextResponse } from 'next/server';
import axios from 'axios';

/**
 * API endpoint to test the OpenRouter API key
 */
export async function GET(request: Request) {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    
    // Log the API key (masked for security)
    const maskedKey = apiKey ? 
      apiKey.substring(0, 5) + '...' + apiKey.substring(apiKey.length - 5) : 
      'NOT SET';
    console.log(`Using OpenRouter API key: ${maskedKey}`);
    
    // Log environment information
    console.log('Environment variables:');
    console.log('- NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL || 'not set');
    console.log('- NODE_ENV:', process.env.NODE_ENV || 'not set');
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenRouter API key is not configured' },
        { status: 500 }
      );
    }
    
    // Make a simple request to OpenRouter to check if the API key is valid
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'google/gemma-3-4b-it:free',
        messages: [
          {
            role: 'user',
            content: 'Hello, this is a test message to verify the API key is working.'
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://lazy-trends.vercel.app',
          'X-Title': 'Lazy Trends API Key Test',
          'Content-Type': 'application/json'
        }
      }
    );
    
    return NextResponse.json({
      status: 'success',
      message: 'OpenRouter API key is valid',
      apiKeyFirstFiveChars: apiKey.substring(0, 5),
      apiKeyLength: apiKey.length,
      responseStatus: response.status,
      model: response.data.model,
      content: response.data.choices[0].message.content.substring(0, 100) + '...'
    });
  } catch (error: any) {
    console.error('Error testing OpenRouter API key:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to validate OpenRouter API key',
        message: error.message,
        status: error.response?.status,
        data: error.response?.data ? JSON.stringify(error.response.data).substring(0, 200) : 'No response data',
        apiKeyLength: process.env.OPENROUTER_API_KEY ? process.env.OPENROUTER_API_KEY.length : 0
      },
      { status: 500 }
    );
  }
}
