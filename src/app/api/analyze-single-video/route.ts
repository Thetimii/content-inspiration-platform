import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';

/**
 * API endpoint to analyze a single video
 * This is called by analyze-one-by-one to chain processing and avoid timeouts
 */
export async function POST(request: Request) {
  try {
    const { userId, videoIds, currentIndex } = await request.json();

    if (!userId || !videoIds || !Array.isArray(videoIds) || currentIndex === undefined) {
      return NextResponse.json(
        { error: 'User ID, videoIds array, and currentIndex are required' },
        { status: 400 }
      );
    }

    if (currentIndex < 0 || currentIndex >= videoIds.length) {
      return NextResponse.json(
        { error: 'Invalid currentIndex' },
        { status: 400 }
      );
    }

    console.log(`Processing single video ${currentIndex + 1}/${videoIds.length} for user ${userId}`);

    // Import the processVideoAndChain function from analyze-one-by-one
    const { processVideoAndChain } = await import('../analyze-one-by-one/route');

    // Start processing this video in the background
    // We don't await this to avoid timeouts
    processVideoAndChain(videoIds, currentIndex, userId).catch(error => {
      console.error('Error in background processing:', error);
    });

    // Return immediately with a success response
    return NextResponse.json({
      success: true,
      message: `Started processing video ${currentIndex + 1}/${videoIds.length} for user ${userId}. Results will be saved automatically.`,
      status: 'processing'
    });
  } catch (error: any) {
    console.error('Error in analyze-single-video API route:', error);

    return NextResponse.json(
      {
        error: error.message || 'An error occurred during video analysis',
        suggestion: 'Please try again later or contact support if the issue persists.'
      },
      { status: 500 }
    );
  }
}
