import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';
import { sendRecommendationEmail } from '@/utils/brevoEmail';

/**
 * API endpoint to send recommendation emails to users
 * This can be triggered by a cron job or manually
 */
export async function POST(request: Request) {
  try {
    const { userId, force = false } = await request.json();

    // If userId is provided, send email to that specific user
    if (userId) {
      return await sendEmailToUser(userId, force);
    }

    // Otherwise, send emails to all users whose preferred time matches current time
    return await sendScheduledEmails();
  } catch (error: any) {
    console.error('Error in email scheduler:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred' },
      { status: 500 }
    );
  }
}

/**
 * Send an email to a specific user
 * @param userId - The user ID
 * @param force - Whether to force send regardless of time preferences
 */
async function sendEmailToUser(userId: string, force: boolean = false) {
  // Get user data
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (userError) {
    return NextResponse.json(
      { error: 'User not found' },
      { status: 404 }
    );
  }

  // Check if user has email notifications enabled
  if (!userData.email_notifications && !force) {
    return NextResponse.json(
      { message: 'User has email notifications disabled' },
      { status: 200 }
    );
  }

  // Get user's email from auth
  const { data: authData, error: authError } = await supabase.auth.admin.getUserById(userId);
  
  if (authError || !authData?.user) {
    return NextResponse.json(
      { error: 'Could not retrieve user email' },
      { status: 500 }
    );
  }

  const userEmail = authData.user.email;
  
  if (!userEmail) {
    return NextResponse.json(
      { error: 'User has no email address' },
      { status: 400 }
    );
  }

  // Get latest recommendations for user
  const { data: recommendations, error: recError } = await supabase
    .from('recommendations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (recError) {
    return NextResponse.json(
      { error: 'Error fetching recommendations' },
      { status: 500 }
    );
  }

  // If no recommendations, don't send email
  if (!recommendations || recommendations.length === 0) {
    return NextResponse.json(
      { message: 'No recommendations available for this user' },
      { status: 200 }
    );
  }

  // Send the email
  try {
    await sendRecommendationEmail(
      userEmail,
      userData.full_name || '',
      recommendations
    );

    // Update last_email_sent timestamp
    await supabase
      .from('users')
      .update({ last_email_sent: new Date().toISOString() })
      .eq('id', userId);

    return NextResponse.json(
      { message: 'Email sent successfully' },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to send email: ' + error.message },
      { status: 500 }
    );
  }
}

/**
 * Send scheduled emails to all users whose preferred time matches current time
 */
async function sendScheduledEmails() {
  const now = new Date();
  const currentHour = now.getUTCHours();
  const currentMinute = now.getUTCMinutes();
  
  // Find users whose preferred time matches current time (within a 5-minute window)
  const { data: users, error } = await supabase
    .from('users')
    .select('*')
    .eq('email_notifications', true)
    .eq('email_time_hour', currentHour)
    .gte('email_time_minute', currentMinute - 5)
    .lte('email_time_minute', currentMinute + 5);

  if (error) {
    return NextResponse.json(
      { error: 'Error fetching users' },
      { status: 500 }
    );
  }

  if (!users || users.length === 0) {
    return NextResponse.json(
      { message: 'No users scheduled for emails at this time' },
      { status: 200 }
    );
  }

  // Send emails to each user
  const results = await Promise.allSettled(
    users.map(async (user) => {
      try {
        await sendEmailToUser(user.id, true);
        return { userId: user.id, status: 'success' };
      } catch (error) {
        return { userId: user.id, status: 'error', error };
      }
    })
  );

  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  return NextResponse.json({
    message: `Processed ${results.length} emails: ${successful} successful, ${failed} failed`,
    results
  });
}
