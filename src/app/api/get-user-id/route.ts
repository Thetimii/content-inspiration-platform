import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';

/**
 * API endpoint to get a user ID for testing
 */
export async function GET(request: Request) {
  try {
    // Get the first user from the database
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email_notifications, email_time_hour, email_time_minute')
      .limit(1);
    
    if (error) {
      return NextResponse.json(
        { error: `Error fetching users: ${error.message}` },
        { status: 500 }
      );
    }
    
    if (!users || users.length === 0) {
      return NextResponse.json(
        { error: 'No users found in the database' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      userId: users[0].id,
      emailPreferences: {
        notifications: users[0].email_notifications,
        hour: users[0].email_time_hour,
        minute: users[0].email_time_minute
      }
    });
  } catch (error: any) {
    console.error('Error getting user ID:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred' },
      { status: 500 }
    );
  }
}
