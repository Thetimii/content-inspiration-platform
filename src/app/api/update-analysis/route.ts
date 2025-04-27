import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';

/**
 * API endpoint to update the database with video analysis
 * This is used by the Edge Function to update the database after analysis
 */
export async function POST(request: Request) {
  try {
    const { videoId, analysis, updateType } = await request.json();

    if (!videoId || !analysis) {
      return NextResponse.json(
        { error: 'Video ID and analysis are required' },
        { status: 400 }
      );
    }

    console.log(`[UPDATE-ANALYSIS] Updating video ${videoId} with analysis`);
    console.log(`[UPDATE-ANALYSIS] Update type: ${updateType || 'not specified'}`);
    console.log(`[UPDATE-ANALYSIS] Analysis length: ${analysis.length} characters`);

    // Get the current video data
    const { data: video, error: fetchError } = await supabase
      .from('tiktok_videos')
      .select('*')
      .eq('id', videoId)
      .single();

    if (fetchError) {
      console.error(`[UPDATE-ANALYSIS] Error fetching video ${videoId}:`, fetchError);
      return NextResponse.json(
        { error: 'Error fetching video or video not found' },
        { status: 404 }
      );
    }

    // Prepare the update data
    const updateData = {
      frame_analysis: analysis,
      summary: analysis.substring(0, 500) + (analysis.length > 500 ? '...' : ''),
      last_analyzed_at: new Date().toISOString()
    };

    // Update the video with the analysis
    const { data: updateResult, error: updateError } = await supabase
      .from('tiktok_videos')
      .update(updateData)
      .eq('id', videoId)
      .select('id, frame_analysis, last_analyzed_at');

    if (updateError) {
      console.error(`[UPDATE-ANALYSIS] Error updating video ${videoId}:`, updateError);
      return NextResponse.json(
        { error: 'Error updating video' },
        { status: 500 }
      );
    }

    console.log(`[UPDATE-ANALYSIS] Successfully updated video ${videoId}`);
    
    // Verify the update
    if (updateResult && updateResult.length > 0) {
      const updatedVideo = updateResult[0];
      console.log(`[UPDATE-ANALYSIS] Update verification:`, {
        id: updatedVideo.id,
        frame_analysis_length: updatedVideo.frame_analysis ? updatedVideo.frame_analysis.length : 0,
        last_analyzed_at: updatedVideo.last_analyzed_at
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Video analysis updated successfully',
      videoId,
      updateResult
    });

  } catch (error: any) {
    console.error('[UPDATE-ANALYSIS] Unexpected error:', error);
    
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
