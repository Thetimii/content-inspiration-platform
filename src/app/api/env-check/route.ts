import { NextResponse } from 'next/server';

/**
 * API endpoint to check environment variables
 * This is a diagnostic endpoint to help troubleshoot environment variable issues
 */
export async function GET(request: Request) {
  try {
    // Get all environment variables (safely)
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

    // Check for process.env directly
    const hasProcessEnv = typeof process !== 'undefined' && typeof process.env !== 'undefined';

    // Check if next.config.ts env variables are working
    const nextConfigWorking = process.env.OPENROUTER_API_KEY === process.env.OPENROUTER_API_KEY;

    // Check for invalid characters in the API key
    let apiKeyAnalysis = null;
    if (process.env.OPENROUTER_API_KEY) {
      const apiKey = process.env.OPENROUTER_API_KEY;
      const sanitizedKey = apiKey.trim();

      apiKeyAnalysis = {
        originalLength: apiKey.length,
        sanitizedLength: sanitizedKey.length,
        hasSpaces: apiKey.includes(' '),
        hasNewlines: apiKey.includes('\n') || apiKey.includes('\r'),
        hasInvalidChars: /[^\x20-\x7E]/.test(apiKey), // Check for non-printable ASCII chars
        firstFiveChars: sanitizedKey.substring(0, 5),
        lastFiveChars: sanitizedKey.substring(sanitizedKey.length - 5)
      };
    }

    return NextResponse.json({
      status: 'success',
      environment: process.env.NODE_ENV,
      hasProcessEnv,
      nextConfigWorking,
      environmentVariables: envVars,
      apiKeyAnalysis,
      processEnvKeys: Object.keys(process.env).filter(key =>
        !key.includes('SECRET') &&
        !key.includes('KEY') &&
        !key.includes('TOKEN') &&
        !key.includes('PASSWORD')
      ),
    });
  } catch (error: any) {
    console.error('Error checking environment variables:', error);

    return NextResponse.json(
      {
        error: 'Failed to check environment variables',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
