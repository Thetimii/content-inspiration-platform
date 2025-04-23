import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';

export async function POST(request: NextRequest) {
  try {

    // Get the request body
    const { field, value, userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Validate the input
    if (!field || value === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Only allow specific fields to be updated
    const allowedFields = ['business_description', 'weekly_time_commitment', 'social_media_experience'];

    if (!allowedFields.includes(field)) {
      return NextResponse.json(
        { error: 'Invalid field' },
        { status: 400 }
      );
    }

    // Update the user profile
    const { data, error } = await supabase
      .from('users')
      .update({ [field]: value })
      .eq('id', userId)
      .select();

    if (error) {
      console.error('Error updating profile:', error);
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });

  } catch (error) {
    console.error('Error in update-profile API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
