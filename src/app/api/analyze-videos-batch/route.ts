import { NextResponse } from 'next/server';
import axios from 'axios';
import { supabase } from '@/utils/supabase';

// Server-side implementation of video analysis
async function analyzeVideoServer(videoUrl: string) {
  try {
    console.log(`Starting analysis process for video: ${videoUrl}`);

    // Step 1: Register the video URL
    console.log('Step 1: Registering video URL...');
    const registerResponse = await axios.post(
      `${process.env.VIDEO_ANALYZER_URL || 'https://video-analyzer-y3m4k6qhqq-uc.a.run.app'}/upload-url`,
      { url: videoUrl },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 seconds timeout
      }
    );

    const sessionId = registerResponse.data.session_id;
    console.log(`Video registered successfully with session ID: ${sessionId}`);

    // Step 2: Start the analysis
    console.log('Step 2: Starting video analysis...');
    const formData = new URLSearchParams();
    formData.append('client', 'openrouter');
    formData.append('api-key', process.env.OPENROUTER_API_KEY || '');
    formData.append('model', 'meta-llama/llama-4-maverick:free');
    formData.append('max-frames', '3'); // Limit to 3 frames to avoid rate limits
    formData.append('whisper-model', 'tiny'); // Use tiny model for faster processing
    formData.append('duration', '30'); // Limit to 30 seconds of the video

    const startResponse = await axios.post(
      `${process.env.VIDEO_ANALYZER_URL || 'https://video-analyzer-y3m4k6qhqq-uc.a.run.app'}/analyze/${sessionId}`,
      formData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 30000 // 30 seconds timeout
      }
    );

    console.log('Analysis started successfully, waiting for results...');

    // Step 3: Wait a bit for processing (this is a simplified approach)
    // In a production app, you might want to implement polling or use the stream endpoint
    await new Promise(resolve => setTimeout(resolve, 15000)); // Wait 15 seconds

    // Step 4: Get the results
    console.log('Step 4: Retrieving analysis results...');
    let attempts = 0;
    let resultsData = null;

    // Try up to 5 times with increasing delays
    while (attempts < 5 && !resultsData) {
      try {
        const resultsResponse = await axios.get(
          `${process.env.VIDEO_ANALYZER_URL || 'https://video-analyzer-y3m4k6qhqq-uc.a.run.app'}/results/${sessionId}`,
          { timeout: 30000 }
        );

        resultsData = resultsResponse.data;
        console.log('Analysis results retrieved successfully');
      } catch (error: any) {
        attempts++;
        console.log(`Attempt ${attempts} failed, waiting before retry...`);

        // Exponential backoff: 5s, 10s, 20s, 40s, 80s
        const waitTime = Math.pow(2, attempts) * 2500;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    if (!resultsData) {
      throw new Error('Failed to retrieve analysis results after multiple attempts');
    }

    // Process and return the results
    const summary = resultsData.video_description?.response || 'No summary available';
    const transcript = resultsData.transcript?.text || '';
    const frameAnalyses = resultsData.frame_analyses || [];

    return {
      summary,
      transcript,
      frames_analysis: frameAnalyses
    };
  } catch (error: any) {
    console.error(`Error analyzing video on server: ${videoUrl}`, error.message);
    if (error.response) {
      console.error('Error response status:', error.response.status);
      console.error('Error response data:', error.response.data);
    }

    // In case of API failure, return a basic summary
    return {
      summary: 'Video analysis unavailable. Please try again later.',
      transcript: '',
      frames_analysis: []
    };
  }
}

export async function POST(request: Request) {
  try {
    const { videoIds } = await request.json();

    if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
      return NextResponse.json(
        { error: 'Video IDs array is required' },
        { status: 400 }
      );
    }

    console.log(`Batch analyzing ${videoIds.length} videos...`);

    // Fetch videos from database
    const { data: videos, error: fetchError } = await supabase
      .from('tiktok_videos')
      .select('*')
      .in('id', videoIds);

    if (fetchError) {
      console.error('Error fetching videos:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch videos' },
        { status: 500 }
      );
    }

    if (!videos || videos.length === 0) {
      return NextResponse.json(
        { error: 'No videos found with the provided IDs' },
        { status: 404 }
      );
    }

    // Process videos sequentially to avoid overwhelming the API
    // The video analyzer service has rate limits and can't handle parallel requests well
    const results = [];

    // Process only the first 5 videos to avoid timeouts and rate limits
    const videosToProcess = videos.slice(0, 5);
    console.log(`Processing ${videosToProcess.length} videos out of ${videos.length} total`);

    for (const video of videosToProcess) {
      try {
        console.log(`Analyzing video: ${video.id} - ${video.video_url}`);

        // Skip videos that already have a summary
        if (video.summary) {
          console.log(`Video ${video.id} already has a summary, skipping analysis`);
          results.push({
            videoId: video.id,
            success: true,
            skipped: true,
            message: 'Video already has a summary'
          });
          continue;
        }

        // Analyze video
        const analysis = await analyzeVideoServer(video.video_url);

        // Update video with summary
        const { data, error } = await supabase
          .from('tiktok_videos')
          .update({
            summary: analysis.summary,
            transcript: analysis.transcript || '',
            // Store the first frame analysis as a JSON string if available
            frame_analysis: analysis.frames_analysis && analysis.frames_analysis.length > 0
              ? JSON.stringify(analysis.frames_analysis[0])
              : null
          })
          .eq('id', video.id)
          .select();

        if (error) {
          console.error(`Error updating video ${video.id} with summary:`, error);
          results.push({
            videoId: video.id,
            success: false,
            error: 'Failed to update video with summary'
          });
        } else {
          results.push({
            videoId: video.id,
            success: true,
            summary: analysis.summary
          });
        }

        // Add a delay between videos to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay

      } catch (error: any) {
        console.error(`Error analyzing video ${video.id}:`, error);
        results.push({
          videoId: video.id,
          success: false,
          error: error.message || 'Unknown error'
        });
      }
    }

    // If there are more videos, schedule them for later processing
    if (videos.length > videosToProcess.length) {
      console.log(`Scheduling ${videos.length - videosToProcess.length} remaining videos for later processing`);
      // In a production app, you might want to implement a queue system
      // For now, we'll just log this information
    }

    return NextResponse.json({
      success: true,
      total: videoIds.length,
      processed: results.length,
      results
    });
  } catch (error: any) {
    console.error('Error in analyze-videos-batch API route:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred' },
      { status: 500 }
    );
  }
}
