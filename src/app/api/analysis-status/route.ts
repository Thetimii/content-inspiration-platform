import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';

/**
 * API endpoint to check the status of a video analysis
 * This allows the frontend to poll for updates without hitting Vercel timeout limits
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

    console.log(`Checking analysis status for video ${videoId}`);

    // Get the video from the database
    const { data: video, error: videoError } = await supabase
      .from('tiktok_videos')
      .select('id, frame_analysis, last_analyzed_at')
      .eq('id', videoId)
      .single();

    if (videoError) {
      console.error('Error fetching video:', videoError);
      return NextResponse.json(
        { error: 'Error fetching video' },
        { status: 500 }
      );
    }

    if (!video) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    // Check if analysis is complete
    const isAnalysisComplete = video.frame_analysis && 
                              video.frame_analysis !== 'Analysis in progress...' &&
                              !video.frame_analysis.startsWith('Analysis failed:');
    
    // Check if analysis failed
    const isAnalysisFailed = video.frame_analysis && 
                            video.frame_analysis.startsWith('Analysis failed:');

    // Return the status
    return NextResponse.json({
      videoId: video.id,
      status: isAnalysisComplete ? 'complete' : (isAnalysisFailed ? 'failed' : 'processing'),
      analysis: isAnalysisComplete ? video.frame_analysis : null,
      error: isAnalysisFailed ? video.frame_analysis.replace('Analysis failed: ', '') : null,
      lastUpdated: video.last_analyzed_at
    });
    
  } catch (error: any) {
    console.error('Unexpected error in analysis-status route:', error);
    
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
