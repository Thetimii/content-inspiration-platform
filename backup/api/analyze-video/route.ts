import { NextResponse } from 'next/server';
import axios from 'axios';
import { supabase } from '@/utils/supabase';

// Server-side implementation of video analysis
export async function analyzeVideoServer(videoUrl: string) {
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

    // Step 3: Wait for processing to complete
    // Based on the API documentation, we need to wait for the analysis to complete
    // There's no status endpoint, so we'll use a fixed delay and then try to get results
    console.log('Step 3: Waiting for analysis to complete...');

    // Wait for 30 seconds initially
    console.log('Waiting 30 seconds for initial processing...');
    await new Promise(resolve => setTimeout(resolve, 30000));

    // Try to check if there's a stream endpoint we can use to monitor progress
    try {
      console.log('Checking stream endpoint for progress updates...');
      const streamResponse = await axios.get(
        `${process.env.VIDEO_ANALYZER_URL || 'https://video-analyzer-y3m4k6qhqq-uc.a.run.app'}/analyze/${sessionId}/stream`,
        {
          timeout: 5000,
          // Set responseType to 'text' to handle streaming responses
          responseType: 'text'
        }
      );

      console.log('Stream response received, analysis might be in progress');
    } catch (streamError) {
      console.log('Stream endpoint not available or returned an error, continuing with fixed delays');
    }

    // Wait another 30 seconds to give the analysis more time
    console.log('Waiting additional 30 seconds for processing to complete...');
    await new Promise(resolve => setTimeout(resolve, 30000));

    // Step 4: Get the results
    console.log('Step 4: Retrieving analysis results...');
    let attempts = 0;
    let resultsData = null;
    const maxResultAttempts = 10; // Try up to 10 times

    // Try multiple times with increasing delays
    while (attempts < maxResultAttempts && !resultsData) {
      try {
        console.log(`Attempt ${attempts + 1}/${maxResultAttempts} to retrieve results...`);
        const resultsResponse = await axios.get(
          `${process.env.VIDEO_ANALYZER_URL || 'https://video-analyzer-y3m4k6qhqq-uc.a.run.app'}/results/${sessionId}`,
          { timeout: 30000 }
        );

        // Check if we got valid results
        if (resultsResponse.data &&
            (resultsResponse.data.video_description ||
             resultsResponse.data.transcript ||
             resultsResponse.data.frame_analyses)) {
          resultsData = resultsResponse.data;
          console.log('Analysis results retrieved successfully');
          console.log('Results summary:', resultsResponse.data.video_description?.response?.substring(0, 100) + '...');
        } else {
          // We got a response but it doesn't have the expected data
          console.log('Received response but missing expected data:', JSON.stringify(resultsResponse.data).substring(0, 200) + '...');
          attempts++;

          // Wait before trying again
          const waitTime = 15000; // Fixed 15 second wait
          console.log(`Waiting ${waitTime/1000} seconds before next attempt...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      } catch (error: any) {
        attempts++;
        console.log(`Attempt ${attempts}/${maxResultAttempts} failed, waiting before retry...`);

        if (error.response) {
          console.log(`Error response: ${error.response.status} - ${JSON.stringify(error.response.data).substring(0, 200)}`);
        } else {
          console.log(`Error: ${error.message}`);
        }

        // Use a fixed wait time instead of exponential backoff
        const waitTime = 15000; // 15 seconds
        console.log(`Waiting ${waitTime/1000} seconds before next attempt...`);
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
    const { videoId, videoUrl } = await request.json();

    if (!videoId || !videoUrl) {
      return NextResponse.json(
        { error: 'Video ID and URL are required' },
        { status: 400 }
      );
    }

    // Analyze video using server-side implementation
    const analysis = await analyzeVideoServer(videoUrl);

    // Update video with summary, transcript, and frame analysis
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
      .eq('id', videoId)
      .select('*, trend_queries(query)');

    if (error) {
      console.error('Error updating video with summary:', error);
      return NextResponse.json(
        { error: 'Failed to update video with summary' },
        { status: 500 }
      );
    }

    return NextResponse.json({ video: data[0], analysis });
  } catch (error: any) {
    console.error('Error in analyze-video API route:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred' },
      { status: 500 }
    );
  }
}
