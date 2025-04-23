// Direct API approach using Brevo API
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

import { getRecommendationEmailTemplate } from './emailTemplates';

/**
 * Send a recommendation email to a user
 * @param userEmail - The recipient's email address
 * @param userName - The recipient's name
 * @param recommendations - The recommendation data to include in the email
 * @returns Promise with the API response
 */
export async function sendRecommendationEmail(
  userEmail: string,
  userName: string,
  recommendations: any
) {
  try {
    console.log(`Attempting to send email to ${userEmail}`);
    console.log(`Using Brevo API key: ${BREVO_API_KEY ? BREVO_API_KEY.substring(0, 10) + '...' : 'NOT SET'}`);

    // Create the email content
    const subject = 'Your TikTok Trend Recommendations from Lazy Trends';
    const htmlContent = getRecommendationEmailTemplate(userName, recommendations);

    // Create the email payload - using the exact format from Brevo documentation
    const payload = {
      sender: {
        name: 'Lazy Trends',
        email: 'sagertim02@gmail.com' // Use a verified sender email
      },
      to: [{
        email: userEmail,
        name: userName || userEmail
      }],
      subject,
      htmlContent,
      replyTo: {
        email: 'sagertim02@gmail.com',
        name: 'Lazy Trends Support'
      }
    };

    console.log('Sending email with payload:', JSON.stringify(payload, null, 2));

    // Send the email using fetch API
    const response = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY || '',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    console.log(`Brevo API response status: ${response.status}`);
    console.log(`Brevo API response body: ${responseText}`);

    if (!response.ok) {
      throw new Error(`Brevo API error: Status ${response.status}, Response: ${responseText}`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.log('Response is not valid JSON, using text response');
      data = { messageId: responseText };
    }

    console.log('Email sent successfully:', data);
    return data;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}



/**
 * Schedule emails for all users based on their preferences
 * This function is now handled by the API endpoint /api/cron/email-scheduler
 * @deprecated Use the API endpoint instead
 */
export async function scheduleEmailsForAllUsers() {
  console.warn('scheduleEmailsForAllUsers() is deprecated. Use the API endpoint /api/cron/email-scheduler instead.');
  // This function is now handled by the API endpoint
  // It would query all users with email_notifications enabled
  // and send emails to those whose preferred time matches the current time
  console.log('Use the API endpoint /api/cron/email-scheduler instead');
}
