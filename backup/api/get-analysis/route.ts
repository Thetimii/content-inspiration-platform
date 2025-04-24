import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';

/**
 * Endpoint to get the current analysis status and result for a video
 */
export async function GET(request: Request) {
  try {
    // Get the video ID from the URL query parameters
    const url = new URL(request.url);
    const videoId = url.searchParams.get('videoId');

    if (!videoId) {
      return NextResponse.json(
        { error: 'Video ID is required' },
        { status: 400 }
      );
    }

    // Get the video data from the database
    const { data: videoData, error: videoError } = await supabase
      .from('tiktok_videos')
      .select('summary, last_analyzed_at')
      .eq('id', videoId)
      .single();

    if (videoError) {
      console.error('Error fetching video data:', videoError);
      return NextResponse.json(
        { error: 'Failed to fetch video data' },
        { status: 500 }
      );
    }

    // Return the analysis status and result
    return NextResponse.json({
      videoId,
      summary: videoData.summary || 'No analysis available',
      lastAnalyzedAt: videoData.last_analyzed_at,
      status: videoData.summary === 'Analysis in progress...' ? 'in_progress' : 'completed'
    });
  } catch (error: any) {
    console.error('Error getting analysis status:', error);

    return NextResponse.json(
      {
        error: error.message || 'An error occurred while getting analysis status',
        suggestion: 'Please try again later or contact support if the issue persists.'
      },
      { status: 500 }
    );
  }
}
