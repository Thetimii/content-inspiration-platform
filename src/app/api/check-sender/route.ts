import { NextResponse } from 'next/server';

/**
 * API endpoint to check sender status in Brevo
 */
export async function GET(request: Request) {
  try {
    const BREVO_API_KEY = process.env.BREVO_API_KEY;
    
    // Log the API key (masked for security)
    const maskedKey = BREVO_API_KEY ? 
      BREVO_API_KEY.substring(0, 10) + '...' + BREVO_API_KEY.substring(BREVO_API_KEY.length - 5) : 
      'NOT SET';
    console.log(`Using Brevo API key: ${maskedKey}`);
    
    // Check senders
    const response = await fetch('https://api.brevo.com/v3/senders', {
      method: 'GET',
      headers: {
        'api-key': BREVO_API_KEY || '',
        'Accept': 'application/json'
      }
    });
    
    const responseText = await response.text();
    console.log(`Brevo API response status: ${response.status}`);
    console.log(`Brevo API response body: ${responseText}`);
    
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to check senders: ${response.statusText}` },
        { status: response.status }
      );
    }
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      return NextResponse.json(
        { error: 'Invalid response from Brevo API' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      message: 'Sender status checked successfully',
      senders: data
    });
  } catch (error: any) {
    console.error('Error checking sender status:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred' },
      { status: 500 }
    );
  }
}
