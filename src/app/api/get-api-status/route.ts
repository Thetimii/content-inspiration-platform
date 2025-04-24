import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';

/**
 * API endpoint to get the status of various APIs from the database
 */
export async function GET(request: Request) {
  try {
    // Get the API status from the database
    const { data, error } = await supabase
      .from('api_status')
      .select('*')
      .order('last_checked', { ascending: false });
    
    if (error) {
      throw error;
    }
    
    // Also run a live check of the OpenRouter API key
    const apiKey = process.env.OPENROUTER_API_KEY;
    let apiKeyAnalysis = null;
    
    if (apiKey) {
      const sanitizedKey = apiKey.trim();
      
      apiKeyAnalysis = {
        originalLength: apiKey.length,
        sanitizedLength: sanitizedKey.length,
        hasSpaces: apiKey.includes(' '),
        hasNewlines: apiKey.includes('\n') || apiKey.includes('\r'),
        hasInvalidChars: /[^\x20-\x7E]/.test(apiKey),
        firstFiveChars: sanitizedKey.substring(0, 5),
        lastFiveChars: sanitizedKey.substring(sanitizedKey.length - 5)
      };
    }
    
    // Get environment variables (safely)
    const envVars = {
      NODE_ENV: process.env.NODE_ENV || 'not set',
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'not set',
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'set (masked)' : 'not set',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'set (masked)' : 'not set',
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ?
        `set (length: ${process.env.OPENROUTER_API_KEY.length}, starts with: ${process.env.OPENROUTER_API_KEY.substring(0, 5)}..., sanitized length: ${process.env.OPENROUTER_API_KEY.trim().length})` :
        'not set',
      RAPIDAPI_KEY: process.env.RAPIDAPI_KEY ? 'set (masked)' : 'not set',
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ? 'set (masked)' : 'not set',
      STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ? 'set (masked)' : 'not set',
      BREVO_API_KEY: process.env.BREVO_API_KEY ? 'set (masked)' : 'not set',
    };
    
    return NextResponse.json({
      status: 'success',
      apiStatus: data,
      apiKeyAnalysis,
      environmentVariables: envVars,
      environment: process.env.NODE_ENV,
      hasProcessEnv: typeof process !== 'undefined' && typeof process.env !== 'undefined',
      nextConfigWorking: process.env.OPENROUTER_API_KEY === process.env.OPENROUTER_API_KEY,
    });
  } catch (error: any) {
    console.error('Error getting API status:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to get API status',
        message: error.message
      },
      { status: 500 }
    );
  }
}
