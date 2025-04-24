import { NextResponse } from 'next/server';
import axios from 'axios';
import { supabase } from '@/utils/supabase';

/**
 * API endpoint to analyze videos one by one
 * This is called after process-queries to avoid timeouts
 */
export async function POST(request: Request) {
  try {
    const { userId, videoIds } = await request.json();

    if (!userId || !videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
      return NextResponse.json(
        { error: 'User ID and video IDs are required' },
        { status: 400 }
      );
    }

    console.log(`Starting analysis for ${videoIds.length} videos for user ${userId}`);

    // Process the first video immediately and schedule the rest
    const firstVideoId = videoIds[0];
    const remainingVideoIds = videoIds.slice(1);

    // Process the first video
    try {
      await analyzeVideo(firstVideoId);
      console.log(`Analyzed first video: ${firstVideoId}`);
    } catch (error) {
      console.error(`Error analyzing first video ${firstVideoId}:`, error);
    }

    // Add a delay before processing the next video to avoid rate limiting
    if (remainingVideoIds.length > 0) {
      console.log(`Adding a 5-second delay before processing the next video...`);
      await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay
    }

    // Process the remaining videos directly
    if (remainingVideoIds.length > 0) {
      try {
        // Make a direct API call to process the next video
        console.log(`Directly calling analyze-one-by-one for the next ${remainingVideoIds.length} videos`);

        const nextAnalysisResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/analyze-one-by-one`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            videoIds: remainingVideoIds
          })
        });

        if (!nextAnalysisResponse.ok) {
          const errorData = await nextAnalysisResponse.json();
          console.error('Error from next analyze-one-by-one call:', errorData);
        } else {
          const nextAnalysisData = await nextAnalysisResponse.json();
          console.log('Next analyze-one-by-one response:', nextAnalysisData);
        }
      } catch (e) {
        console.error('Failed to call next video analysis:', e);
      }
    } else {
      // All videos have been analyzed, generate a recommendation
      try {
        console.log('All videos analyzed, generating recommendation...');

        // Make a direct API call to generate recommendations
        const recommendationResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/generate-recommendation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            videoIds
          })
        });

        if (!recommendationResponse.ok) {
          const errorData = await recommendationResponse.json();
          console.error('Error from generate-recommendation:', errorData);
        } else {
          const recommendationData = await recommendationResponse.json();
          console.log('Generate-recommendation response:', recommendationData);
        }
      } catch (e) {
        console.error('Failed to generate recommendation:', e);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Started analysis for video ${firstVideoId}, scheduled ${remainingVideoIds.length} more`
    });
  } catch (error: any) {
    console.error('Error in analyze-one-by-one API route:', error);

    return NextResponse.json(
      {
        error: error.message || 'An error occurred during video analysis',
        suggestion: 'Please try again later or contact support if the issue persists.'
      },
      { status: 500 }
    );
  }
}

// Function to analyze a single video
async function analyzeVideo(videoId: string) {
  try {
    console.log(`Starting analysis for video ID: ${videoId}`);

    // Get the video URL and download URL
    const { data: videoData, error: videoError } = await supabase
      .from('tiktok_videos')
      .select('video_url, download_url')
      .eq('id', videoId)
      .single();

    if (videoError) {
      throw new Error(`Error fetching video ${videoId}: ${videoError.message}`);
    }

    console.log(`Retrieved video data: ${JSON.stringify(videoData)}`);

    // Set a flag in the database to indicate analysis is in progress
    await supabase
      .from('tiktok_videos')
      .update({ summary: 'Analysis in progress...' })
      .eq('id', videoId);

    console.log(`Updated video ${videoId} status to "Analysis in progress..."`);

    // Use download_url if available, otherwise fall back to video_url
    const urlToAnalyze = videoData.download_url || videoData.video_url;
    if (!urlToAnalyze) {
      throw new Error(`No URL available for video ${videoId}`);
    }

    console.log(`Using URL for analysis: ${urlToAnalyze}`);

    // Prepare the prompt for the multimodal model
    const prompt = `Analyze this TikTok video in detail. Please provide:
1. A comprehensive summary of what's happening in the video
2. Key visual elements and objects present
3. Any text or captions visible in the video
4. The overall theme or message of the content
5. What makes this content engaging or trending

Be specific and detailed in your analysis.`;

    // Get and sanitize the API key
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OpenRouter API key is missing');
    }

    // Sanitize the API key - remove any whitespace or invalid characters
    const sanitizedApiKey = apiKey.trim();
    console.log(`API key sanitized. Original length: ${apiKey.length}, sanitized length: ${sanitizedApiKey.length}`);

    console.log(`Making API call to OpenRouter for video ${videoId}...`);

    // Try different models in case one fails
    let response;
    let modelUsed;

    try {
      console.log('Attempting to use Qwen 2.5 VL model...');
      modelUsed = 'qwen/qwen-2.5-vl-72b-instruct';

      // Make the API call to OpenRouter using the Qwen 2.5 VL model
      response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: modelUsed, // Multimodal model that can analyze images
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: prompt
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: urlToAnalyze
                  }
                }
              ]
            }
          ]
        },
        {
          headers: {
            'Authorization': `Bearer ${sanitizedApiKey}`,
            'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
            'X-Title': 'Lazy Trends',
            'Content-Type': 'application/json'
          },
          timeout: 120000 // 120 seconds timeout for video processing
        }
      );

      console.log(`Successfully used ${modelUsed} model`);
    } catch (error: any) {
      console.error(`Error with Qwen model: ${error.message}`);

      // Try Claude 3 Sonnet Vision as a fallback
      try {
        console.log('Falling back to Claude 3 Sonnet Vision model...');
        modelUsed = 'anthropic/claude-3-sonnet-20240229-v1:0';

        response = await axios.post(
          'https://openrouter.ai/api/v1/chat/completions',
          {
            model: modelUsed,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: prompt
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: urlToAnalyze
                    }
                  }
                ]
              }
            ]
          },
          {
            headers: {
              'Authorization': `Bearer ${sanitizedApiKey}`,
              'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
              'X-Title': 'Lazy Trends',
              'Content-Type': 'application/json'
            },
            timeout: 120000 // 120 seconds timeout for video processing
          }
        );

        console.log(`Successfully used ${modelUsed} model as fallback`);
      } catch (fallbackError: any) {
        console.error(`Error with fallback model: ${fallbackError.message}`);
        throw new Error(`Failed to analyze video with both models: ${error.message}, fallback error: ${fallbackError.message}`);
      }
    }

    console.log(`Received response from OpenRouter for video ${videoId}`);

    // Log the response structure
    console.log('Response structure:', JSON.stringify({
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: {
        id: response.data.id,
        model: response.data.model,
        choices: response.data.choices ? [{
          index: response.data.choices[0]?.index,
          message: {
            role: response.data.choices[0]?.message?.role,
            content_length: response.data.choices[0]?.message?.content?.length
          }
        }] : 'No choices'
      }
    }));

    // Extract the analysis from the response
    let analysis = response.data.choices[0]?.message?.content || 'No analysis available';
    console.log('Analysis summary:', analysis.substring(0, 100) + '...');

    // Update the video with the analysis results
    console.log(`Updating video ${videoId} with analysis results...`);
    const { error: updateError } = await supabase
      .from('tiktok_videos')
      .update({
        summary: analysis,
        last_analyzed_at: new Date().toISOString()
      })
      .eq('id', videoId);

    if (updateError) {
      throw new Error(`Error updating video ${videoId} with analysis: ${updateError.message}`);
    }

    console.log(`Video ${videoId} analysis completed and saved successfully`);
    return true;
  } catch (error: any) {
    console.error(`Error analyzing video ${videoId}:`, error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      responseStatus: error.response?.status,
      responseData: error.response?.data ? JSON.stringify(error.response.data).substring(0, 200) : 'No response data'
    });

    // Update the database with an error message
    try {
      await supabase
        .from('tiktok_videos')
        .update({
          summary: `Error analyzing video: ${error.message}`,
          last_analyzed_at: new Date().toISOString()
        })
        .eq('id', videoId);

      console.log(`Updated video ${videoId} with error message`);
    } catch (updateError) {
      console.error(`Error updating video ${videoId} with error message:`, updateError);
    }

    throw error;
  }
}
