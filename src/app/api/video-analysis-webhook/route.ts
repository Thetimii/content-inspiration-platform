import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';

/**
 * Webhook endpoint for video analysis
 * This can be called by an external service to update the analysis status
 */
export async function POST(request: Request) {
  try {
    // Verify the webhook secret to ensure the request is legitimate
    const webhookSecret = process.env.WEBHOOK_SECRET;
    const authHeader = request.headers.get('authorization');
    
    if (!webhookSecret || !authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== webhookSecret) {
      console.error('[WEBHOOK] Invalid or missing authorization');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Parse the request body
    const { videoId, analysis, status, error } = await request.json();
    
    if (!videoId) {
      console.error('[WEBHOOK] Missing videoId');
      return NextResponse.json({ error: 'Missing videoId' }, { status: 400 });
    }
    
    console.log(`[WEBHOOK] Received webhook for video ${videoId} with status ${status}`);
    
    // Get the current video data
    const { data: video, error: fetchError } = await supabase
      .from('tiktok_videos')
      .select('*')
      .eq('id', videoId)
      .single();
    
    if (fetchError || !video) {
      console.error(`[WEBHOOK] Error fetching video ${videoId}:`, fetchError);
      return NextResponse.json(
        { error: 'Error fetching video or video not found' },
        { status: 404 }
      );
    }
    
    // Update the video based on the status
    if (status === 'completed' && analysis) {
      console.log(`[WEBHOOK] Updating video ${videoId} with completed analysis`);
      
      const updateData = {
        frame_analysis: analysis,
        summary: analysis.substring(0, 500) + (analysis.length > 500 ? '...' : ''),
        last_analyzed_at: new Date().toISOString()
      };
      
      const { error: updateError } = await supabase
        .from('tiktok_videos')
        .update(updateData)
        .eq('id', videoId);
      
      if (updateError) {
        console.error(`[WEBHOOK] Error updating video ${videoId}:`, updateError);
        return NextResponse.json(
          { error: 'Error updating video' },
          { status: 500 }
        );
      }
      
      return NextResponse.json({
        success: true,
        message: 'Video analysis updated successfully',
        videoId
      });
    } else if (status === 'failed' && error) {
      console.log(`[WEBHOOK] Updating video ${videoId} with error: ${error}`);
      
      const { error: updateError } = await supabase
        .from('tiktok_videos')
        .update({
          frame_analysis: `Analysis failed: ${error}`,
          last_analyzed_at: new Date().toISOString()
        })
        .eq('id', videoId);
      
      if (updateError) {
        console.error(`[WEBHOOK] Error updating video ${videoId} with error:`, updateError);
        return NextResponse.json(
          { error: 'Error updating video with error status' },
          { status: 500 }
        );
      }
      
      return NextResponse.json({
        success: true,
        message: 'Video error status updated successfully',
        videoId
      });
    } else {
      console.error(`[WEBHOOK] Invalid status or missing required fields`);
      return NextResponse.json(
        { error: 'Invalid status or missing required fields' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('[WEBHOOK] Unexpected error:', error);
    
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
