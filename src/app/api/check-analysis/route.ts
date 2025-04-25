import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';

/**
 * API endpoint to check the status of a video analysis
 * This is a simple endpoint that checks the database for the analysis status
 */
export async function POST(request: Request) {
  try {
    const { videoId } = await request.json();

    if (!videoId) {
      return NextResponse.json(
        { error: 'Video ID is required' },
        { status: 400 }
      );
    }

    console.log(`[CHECK-ANALYSIS] Checking analysis status for video ${videoId}`);

    // Get the video from the database
    const { data: video, error: videoError } = await supabase
      .from('tiktok_videos')
      .select('id, frame_analysis, last_analyzed_at')
      .eq('id', videoId)
      .single();

    if (videoError) {
      console.error(`[CHECK-ANALYSIS] Error fetching video ${videoId}:`, videoError);
      return NextResponse.json(
        { error: 'Error fetching video or video not found' },
        { status: 404 }
      );
    }

    if (!video) {
      console.error(`[CHECK-ANALYSIS] Video ${videoId} not found`);
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    // Check if analysis is complete
    const isAnalysisComplete = video.frame_analysis && video.frame_analysis !== 'Analysis in progress...';
    const isAnalysisFailed = video.frame_analysis && video.frame_analysis.startsWith('Analysis failed:');

    // If analysis has been in progress for more than 5 minutes, consider it failed
    let isAnalysisStuck = false;
    if (video.frame_analysis === 'Analysis in progress...' && video.last_analyzed_at) {
      const lastAnalyzedAt = new Date(video.last_analyzed_at);
      const now = new Date();
      const timeDiffMinutes = (now.getTime() - lastAnalyzedAt.getTime()) / (1000 * 60);
      
      if (timeDiffMinutes > 5) {
        isAnalysisStuck = true;
        
        // Update the video with an error message
        await supabase
          .from('tiktok_videos')
          .update({
            frame_analysis: 'Analysis failed: Analysis took too long and was terminated',
            last_analyzed_at: new Date().toISOString()
          })
          .eq('id', videoId);
          
        console.log(`[CHECK-ANALYSIS] Analysis for video ${videoId} has been stuck for ${timeDiffMinutes.toFixed(2)} minutes, marking as failed`);
      }
    }

    console.log(`[CHECK-ANALYSIS] Video ${videoId} analysis status:`, {
      frame_analysis: video.frame_analysis,
      last_analyzed_at: video.last_analyzed_at,
      isAnalysisComplete,
      isAnalysisFailed,
      isAnalysisStuck
    });

    return NextResponse.json({
      id: video.id,
      frame_analysis: video.frame_analysis,
      last_analyzed_at: video.last_analyzed_at,
      isAnalysisComplete,
      isAnalysisFailed,
      isAnalysisStuck
    });
    
  } catch (error: any) {
    console.error('[CHECK-ANALYSIS] Unexpected error:', error);
    
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
