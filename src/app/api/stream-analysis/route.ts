import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';

/**
 * API endpoint to stream video analysis results
 * This uses Server-Sent Events (SSE) to stream updates to the client
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

    console.log(`[STREAM-ANALYSIS] Starting stream for video ${videoId}`);

    // Create a TextEncoder to convert strings to Uint8Arrays
    const encoder = new TextEncoder();

    // Create a stream
    const stream = new ReadableStream({
      async start(controller) {
        let analysisComplete = false;
        let attempts = 0;
        const maxAttempts = 60; // 5 minutes (5 seconds * 60)

        // Send initial message
        const initialMessage = {
          type: 'status',
          message: 'Starting analysis stream...',
          timestamp: new Date().toISOString()
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialMessage)}\n\n`));

        // Function to check analysis status
        const checkAnalysis = async () => {
          try {
            attempts++;

            // Get the video from the database
            const { data: video, error: videoError } = await supabase
              .from('tiktok_videos')
              .select('id, frame_analysis, last_analyzed_at')
              .eq('id', videoId)
              .single();

            if (videoError) {
              const errorMessage = {
                type: 'error',
                message: `Error fetching video: ${videoError.message}`,
                timestamp: new Date().toISOString()
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorMessage)}\n\n`));
              controller.close();
              return;
            }

            if (!video) {
              const errorMessage = {
                type: 'error',
                message: 'Video not found',
                timestamp: new Date().toISOString()
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorMessage)}\n\n`));
              controller.close();
              return;
            }

            // Check if analysis is complete
            if (video.frame_analysis && video.frame_analysis !== 'Analysis in progress...') {
              // Analysis is complete
              const analysisMessage = {
                type: 'complete',
                analysis: video.frame_analysis,
                timestamp: new Date().toISOString()
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(analysisMessage)}\n\n`));
              analysisComplete = true;
              controller.close();
              return;
            }

            // Check if analysis failed
            if (video.frame_analysis && video.frame_analysis.startsWith('Analysis failed:')) {
              // Analysis failed
              const failureMessage = {
                type: 'failed',
                message: video.frame_analysis,
                timestamp: new Date().toISOString()
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(failureMessage)}\n\n`));
              analysisComplete = true;
              controller.close();
              return;
            }

            // Analysis is still in progress
            const progressMessage = {
              type: 'progress',
              message: 'Analysis in progress...',
              timestamp: new Date().toISOString(),
              attempts
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(progressMessage)}\n\n`));

            // Check if we've reached the maximum number of attempts
            if (attempts >= maxAttempts) {
              const timeoutMessage = {
                type: 'timeout',
                message: 'Analysis timed out after 5 minutes',
                timestamp: new Date().toISOString()
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(timeoutMessage)}\n\n`));
              controller.close();
              return;
            }

            // Continue checking if analysis is not complete
            if (!analysisComplete) {
              setTimeout(checkAnalysis, 5000); // Check every 5 seconds
            }
          } catch (error: any) {
            const errorMessage = {
              type: 'error',
              message: `Error checking analysis: ${error.message}`,
              timestamp: new Date().toISOString()
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorMessage)}\n\n`));
            controller.close();
          }
        };

        // Start checking analysis
        await checkAnalysis();
      }
    });

    // Create a custom response with the appropriate headers for SSE
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });

  } catch (error: any) {
    console.error('[STREAM-ANALYSIS] Unexpected error:', error);

    return NextResponse.json(
      { error: 'An unexpected error occurred', details: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
