import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';
import { sendRecommendationEmail } from '@/utils/brevoEmail';

// Log the Brevo API key (masked for security)
const apiKey = process.env.BREVO_API_KEY || '';
const maskedKey = apiKey.substring(0, 10) + '...' + apiKey.substring(apiKey.length - 5);
console.log(`Email scheduler using Brevo API key: ${maskedKey}`);

/**
 * API endpoint to handle scheduled email sending
 * This should be called by a cron job every hour
 */
export async function GET(request: Request) {
  try {
    // Verify the request is from an authorized source
    // In production, you would add authentication here

    // Get current time in UTC
    const now = new Date();
    const currentHour = now.getUTCHours();
    const currentMinute = now.getUTCMinutes();

    console.log(`Email scheduler running at ${now.toISOString()} (UTC ${currentHour}:${currentMinute})`);

    // Find users whose preferred time matches current time (within a 5-minute window)
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email_notifications, email_time_hour, email_time_minute, last_email_sent')
      .eq('email_notifications', true)
      .eq('email_time_hour', currentHour)
      .gte('email_time_minute', currentMinute - 5)
      .lte('email_time_minute', currentMinute + 5);

    if (error) {
      throw new Error(`Error fetching users: ${error.message}`);
    }

    console.log(`Found ${users?.length || 0} users scheduled for emails at this time`);

    if (!users || users.length === 0) {
      return NextResponse.json({
        message: 'No users scheduled for emails at this time',
        timestamp: now.toISOString(),
      });
    }

    // Process each user
    const results = await Promise.allSettled(
      users.map(async (user) => {
        try {
          console.log(`Processing user ${user.id}`);

          // Check if it's been at least 24 hours since the last email
          const lastEmailSent = user.last_email_sent ? new Date(user.last_email_sent) : null;
          if (lastEmailSent) {
            const hoursSinceLastEmail = (now.getTime() - lastEmailSent.getTime()) / (1000 * 60 * 60);
            console.log(`User ${user.id}: Last email sent ${hoursSinceLastEmail.toFixed(1)} hours ago`);

            if (hoursSinceLastEmail < 24) {
              console.log(`User ${user.id}: Skipping - less than 24 hours since last email`);
              return {
                userId: user.id,
                status: 'skipped',
                reason: `Last email sent ${hoursSinceLastEmail.toFixed(1)} hours ago`,
              };
            }
          } else {
            console.log(`User ${user.id}: No previous emails sent`);
          }

          // Get user's email from auth
          const { data: authData, error: authError } = await supabase.auth.admin.getUserById(user.id);

          if (authError || !authData?.user?.email) {
            throw new Error(`Error fetching user email: ${authError?.message || 'No email found'}`);
          }

          console.log(`User ${user.id}: Found email ${authData.user.email}`);

          // Get latest recommendations for user
          const { data: recommendations, error: recError } = await supabase
            .from('recommendations')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1);

          if (recError) {
            throw new Error(`Error fetching recommendations: ${recError.message}`);
          }

          // If no recommendations, skip this user
          if (!recommendations || recommendations.length === 0) {
            console.log(`User ${user.id}: No recommendations available, skipping`);
            return {
              userId: user.id,
              status: 'skipped',
              reason: 'No recommendations available',
            };
          }

          console.log(`User ${user.id}: Found ${recommendations.length} recommendations, sending email`);

          // Send the email
          const emailResult = await sendRecommendationEmail(
            authData.user.email,
            authData.user.user_metadata?.full_name || '',
            recommendations
          );

          console.log(`User ${user.id}: Email sent successfully with message ID: ${emailResult.messageId}`);

          // Update last_email_sent timestamp
          const { error: updateError } = await supabase
            .from('users')
            .update({ last_email_sent: now.toISOString() })
            .eq('id', user.id);

          if (updateError) {
            console.error(`User ${user.id}: Error updating last_email_sent: ${updateError.message}`);
          } else {
            console.log(`User ${user.id}: Updated last_email_sent to ${now.toISOString()}`);
          }

          return {
            userId: user.id,
            status: 'success',
            email: authData.user.email,
            messageId: emailResult.messageId
          };
        } catch (error: any) {
          return {
            userId: user.id,
            status: 'error',
            error: error.message,
          };
        }
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled' && (r as any).value?.status === 'success').length;
    const skipped = results.filter(r => r.status === 'fulfilled' && (r as any).value?.status === 'skipped').length;
    const failed = results.filter(r => r.status === 'rejected' || (r as any).value?.status === 'error').length;

    console.log(`Email scheduler summary: ${results.length} users processed, ${successful} emails sent, ${skipped} skipped, ${failed} failed`);

    // Get detailed results for logging
    const detailedResults = results.map(r => {
      if (r.status === 'fulfilled') {
        return r.value;
      } else {
        return { status: 'error', error: (r as any).reason };
      }
    });

    console.log('Detailed results:', JSON.stringify(detailedResults, null, 2));

    return NextResponse.json({
      message: `Processed ${results.length} users: ${successful} emails sent, ${skipped} skipped, ${failed} failed`,
      timestamp: now.toISOString(),
      results: detailedResults,
    });
  } catch (error: any) {
    console.error('Error in email scheduler cron job:', error);
    console.error('Stack trace:', error.stack);
    return NextResponse.json(
      {
        error: error.message || 'An error occurred',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
