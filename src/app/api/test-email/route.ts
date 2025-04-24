import { NextResponse } from 'next/server';
import { sendRecommendationEmail } from '@/utils/brevoEmail';
import { supabase } from '@/utils/supabase';

// Log the Brevo API key (masked for security)
const apiKey = process.env.BREVO_API_KEY || '';
const maskedKey = apiKey.substring(0, 10) + '...' + apiKey.substring(apiKey.length - 5);
console.log(`Using Brevo API key: ${maskedKey}`);
console.log(`Base URL: ${process.env.NEXT_PUBLIC_APP_URL}`);

/**
 * API endpoint to send a test email
 */
export async function GET(request: Request) {
  try {
    const email = 'sagertim02@gmail.com';
    const name = 'Tim Sager';

    console.log(`Starting test email process to ${email}`);

    // Create a simple mock recommendation for testing
    const mockRecommendation = {
      id: 'test-id',
      created_at: new Date().toISOString(),
      combined_summary: 'Our analysis of trending car detailing videos shows a strong preference for before/after transformations. Videos featuring dramatic changes in vehicle appearance are generating 45% more engagement than standard detailing videos.',
      content_ideas: [
        'Create a series of extreme makeovers for heavily soiled vehicles',
        'Film detailed close-ups of the cleaning process with ASMR-quality audio',
        'Showcase specialized tools and explain their unique benefits'
      ]
    };

    // Send test email with mock data
    const result = await sendRecommendationEmail(email, name, [mockRecommendation]);

    console.log('Email sending completed with result:', result);

    return NextResponse.json({
      message: `Test email sent to ${email}`,
      result: result
    });
  } catch (error: any) {
    console.error('Error sending test email:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred' },
      { status: 500 }
    );
  }
}
