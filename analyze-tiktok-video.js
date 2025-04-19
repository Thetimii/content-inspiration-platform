// Script to analyze a TikTok video using the Video Analyzer API and save results to Supabase
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

// Initialize Supabase client from environment variables
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// Video Analyzer API URL
const VIDEO_ANALYZER_API_URL = process.env.VIDEO_ANALYZER_API_URL || 'https://video-analyzer-y3m4k6qhqq-uc.a.run.app';

// OpenRouter API key
const OPENROUTER_API_KEY = process.env.NEXT_PUBLIC_OPENROUTER_API_KEY;

// Function to analyze a video and save results to Supabase
async function analyzeAndSaveVideo(videoUrl, videoId, userId, searchQuery = '') {
  console.log('Starting video analysis:', { videoUrl, videoId, userId });

  try {
    // Step 1: Register the video URL
    console.log('Step 1: Registering video URL...');
    const registerResponse = await fetch(`${VIDEO_ANALYZER_API_URL}/upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: videoUrl }),
    });

    if (!registerResponse.ok) {
      const errorText = await registerResponse.text();
      console.error('Video URL registration error:', {
        status: registerResponse.status,
        statusText: registerResponse.statusText,
        body: errorText
      });
      throw new Error(`Video URL registration error: ${registerResponse.status} - ${errorText}`);
    }

    const registerData = await registerResponse.json();
    const sessionId = registerData.session_id;

    if (!sessionId) {
      throw new Error('No session ID returned from registration');
    }

    console.log('Successfully registered video URL, session ID:', sessionId);

    // Step 2: Start the analysis with the session ID
    console.log('Step 2: Starting analysis...');

    // Create form data for the analysis request
    const formData = new URLSearchParams();
    formData.append('client', 'openrouter');
    formData.append('api-key', OPENROUTER_API_KEY);
    formData.append('model', 'meta-llama/llama-4-maverick:free');
    formData.append('max-frames', '5');
    formData.append('whisper-model', 'tiny');
    formData.append('duration', '30');
    formData.append('prompt', 'Analyze this TikTok video and provide insights about: 1. Main activities shown 2. Visual elements and equipment 3. Style and techniques 4. Target audience 5. Key tips. Keep the analysis concise.');

    const analysisResponse = await fetch(`${VIDEO_ANALYZER_API_URL}/analyze/${sessionId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!analysisResponse.ok) {
      const errorText = await analysisResponse.text();
      console.error('Analysis error:', {
        status: analysisResponse.status,
        statusText: analysisResponse.statusText,
        body: errorText
      });
      throw new Error(`Analysis error: ${analysisResponse.status} - ${errorText}`);
    }

    console.log('Analysis started successfully');

    // Step 3: Stream the logs in real-time (optional)
    console.log('Step 3: Streaming analysis logs in real-time...');

    // Create a function to stream logs
    const streamLogs = async () => {
      try {
        const logResponse = await fetch(`${VIDEO_ANALYZER_API_URL}/analyze/${sessionId}/stream`);

        if (!logResponse.body) {
          console.log('No stream body available');
          return;
        }

        const reader = logResponse.body.getReader();
        const decoder = new TextDecoder();

        let done = false;
        while (!done) {
          const { value, done: doneReading } = await reader.read();
          done = doneReading;
          if (value) {
            const text = decoder.decode(value);
            process.stdout.write(text);
          }
        }
      } catch (error) {
        console.error('Error streaming logs:', error);
      }
    };

    // Stream logs for a maximum of 2 minutes
    const streamPromise = streamLogs();
    const timeoutPromise = new Promise(resolve => setTimeout(resolve, 120000));
    await Promise.race([streamPromise, timeoutPromise]);

    // Step 4: Wait for the analysis to complete and get results
    console.log('\nStep 4: Getting analysis results...');

    // Poll for results every 10 seconds for up to 5 minutes
    let analysisText = null;
    let attempts = 0;
    const maxAttempts = 30; // 5 minutes (30 * 10 seconds)

    while (attempts < maxAttempts && !analysisText) {
      try {
        const resultsResponse = await fetch(`${VIDEO_ANALYZER_API_URL}/results/${sessionId}`);

        if (resultsResponse.ok) {
          const resultsData = await resultsResponse.json();

          if (resultsData.error) {
            console.log(`Results not ready yet (attempt ${attempts + 1}/${maxAttempts}): ${resultsData.error}`);
          } else if (resultsData.video_description && resultsData.video_description.response) {
            analysisText = resultsData.video_description.response;
            console.log('Analysis results received successfully');
            break;
          }
        }
      } catch (error) {
        console.error(`Error checking results (attempt ${attempts + 1}/${maxAttempts}):`, error);
      }

      attempts++;
      if (attempts < maxAttempts && !analysisText) {
        console.log(`Waiting 10 seconds before checking again (attempt ${attempts}/${maxAttempts})...`);
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }

    if (!analysisText) {
      throw new Error('Failed to get analysis results after maximum attempts');
    }

    // Step 5: Save the analysis to Supabase
    console.log('Step 5: Saving analysis to Supabase...');

    const { error: saveError } = await supabase
      .from('video_analysis')
      .upsert({
        user_id: userId,
        video_id: videoId,
        search_query: searchQuery || '',
        analysis_result: analysisText,
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (saveError) {
      console.error('Error saving to Supabase:', saveError);
      throw new Error(`Database error: ${saveError.message}`);
    }

    console.log('Analysis saved successfully to Supabase');
    return analysisText;

  } catch (error) {
    console.error('Error in video analysis process:', error);

    // Try to save the error status to Supabase
    try {
      await supabase
        .from('video_analysis')
        .upsert({
          user_id: userId,
          video_id: videoId,
          search_query: searchQuery || '',
          analysis_result: { error: error.message },
          status: 'error',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
    } catch (dbError) {
      console.error('Error saving error status to database:', dbError);
    }

    throw error;
  }
}

// Main function to run the script
async function main() {
  // Check for required environment variables
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('Error: Missing Supabase credentials in environment variables');
    process.exit(1);
  }

  if (!OPENROUTER_API_KEY) {
    console.error('Error: Missing OpenRouter API key in environment variables');
    process.exit(1);
  }

  // Get command line arguments
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.error('Usage: node analyze-tiktok-video.js <video_url> <video_id> <user_id> [search_query]');
    process.exit(1);
  }

  const videoUrl = args[0];
  const videoId = args[1];
  const userId = args[2];
  const searchQuery = args[3] || '';

  try {
    console.log(`Analyzing video: ${videoUrl}`);
    const result = await analyzeAndSaveVideo(videoUrl, videoId, userId, searchQuery);
    console.log('Analysis complete!');
    console.log('Result:', result);
    process.exit(0);
  } catch (error) {
    console.error('Analysis failed:', error);
    process.exit(1);
  }
}

// Export the analyzeAndSaveVideo function for use in other scripts
module.exports = {
  analyzeAndSaveVideo
};

// Run the main function if this script is executed directly
if (require.main === module) {
  main();
}
