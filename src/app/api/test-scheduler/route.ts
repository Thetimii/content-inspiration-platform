import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';

/**
 * API endpoint to test the email scheduler
 * This endpoint will set up a test user with the current time as their preferred email time
 * and then trigger the email scheduler
 */
export async function GET(request: Request) {
  try {
    // Get current time in UTC
    const now = new Date();
    const currentHour = now.getUTCHours();
    const currentMinute = now.getUTCMinutes();

    console.log(`Setting up test user with current time: ${currentHour}:${currentMinute} UTC`);

    // Get the user ID from the query parameters
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId parameter is required' },
        { status: 400 }
      );
    }

    // Update the user's email preferences to match the current time
    const { data: userData, error: userUpdateError } = await supabase
      .from('users')
      .update({
        email_notifications: true,
        email_time_hour: currentHour,
        email_time_minute: currentMinute,
        // Set last_email_sent to null to ensure the email will be sent
        last_email_sent: null
      })
      .eq('id', userId)
      .select();

    if (userUpdateError) {
      return NextResponse.json(
        { error: `Error updating user: ${userUpdateError.message}` },
        { status: 500 }
      );
    }

    console.log(`Updated user ${userId} with email time ${currentHour}:${currentMinute} UTC`);

    // Call the email scheduler API endpoint
    const schedulerResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/cron/email-scheduler`);
    const schedulerData = await schedulerResponse.json();

    return NextResponse.json({
      message: 'Test scheduler completed',
      userUpdate: userData,
      schedulerResponse: schedulerData
    });
  } catch (error: any) {
    console.error('Error in test scheduler:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred' },
      { status: 500 }
    );
  }
}
