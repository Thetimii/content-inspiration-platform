import { NextResponse } from 'next/server';
import axios from 'axios';
import { supabase } from '@/utils/supabase';
import { sendRecommendationEmail } from '@/utils/brevoEmail';

/**
 * A direct, simplified endpoint for video analysis
 * This combines the functionality of trigger-analysis and analyze-video-openrouter
 * into a single endpoint to avoid any issues with API calls between endpoints
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

    console.log(`Starting direct analysis for ${videoIds.length} videos for user ${userId}`);

    // Process videos one by one
    for (let i = 0; i < videoIds.length; i++) {
      const videoId = videoIds[i];
      console.log(`Processing video ${i+1}/${videoIds.length}: ${videoId}`);

      try {
        // Get the video URL and last_analyzed_at timestamp
        const { data: videoData, error: videoError } = await supabase
          .from('tiktok_videos')
          .select('video_url, download_url, last_analyzed_at')
          .eq('id', videoId)
          .single();

        if (videoError) {
          console.error(`Error fetching video ${videoId}:`, videoError);
          continue; // Skip to the next video
        }

        // Check if the video was analyzed within the last 24 hours
        const lastAnalyzedAt = videoData.last_analyzed_at ? new Date(videoData.last_analyzed_at) : null;
        const now = new Date();
        const hoursSinceLastAnalysis = lastAnalyzedAt
          ? (now.getTime() - lastAnalyzedAt.getTime()) / (1000 * 60 * 60)
          : 999; // Large number to ensure it passes the 24-hour check if never analyzed

        if (lastAnalyzedAt && hoursSinceLastAnalysis < 24) {
          console.log(`Skipping analysis for video ${videoId} - last analyzed ${hoursSinceLastAnalysis.toFixed(1)} hours ago`);
          continue; // Skip to the next video
        }

        // Set a flag in the database to indicate analysis is in progress
        await supabase
          .from('tiktok_videos')
          .update({ summary: 'Analysis in progress...' })
          .eq('id', videoId);

        // Use download_url if available, otherwise fall back to video_url
        const urlToAnalyze = videoData.download_url || videoData.video_url;
        console.log(`Using URL for analysis: ${urlToAnalyze}`);

        // Directly analyze the video here instead of calling another endpoint
        try {
          // Analyze the video using OpenRouter
          const analysis = await analyzeVideoWithOpenRouter(urlToAnalyze);

          // Update the video with the analysis results
          console.log(`Updating video ${videoId} with summary`);
          console.log('Summary content:', analysis.summary);

          // First, try to update just the summary field and last_analyzed_at timestamp
          const { error: updateError } = await supabase
            .from('tiktok_videos')
            .update({
              summary: analysis.summary || 'Analysis completed but no summary was generated.',
              last_analyzed_at: new Date().toISOString()
            })
            .eq('id', videoId);

          if (updateError) {
            console.error(`Error updating video ${videoId} with analysis:`, updateError);
            // If there was an error updating, try to set an error message
            await supabase
              .from('tiktok_videos')
              .update({ summary: 'Error saving analysis results. Please try again.' })
              .eq('id', videoId);
          } else {
            console.log(`Video ${videoId} analysis completed and saved successfully`);
          }
        } catch (analysisError: any) {
          console.error(`Error during video ${videoId} analysis:`, analysisError.message);
          // Update the database with a more user-friendly error message
          await supabase
            .from('tiktok_videos')
            .update({
              summary: analysisError.message.includes('timed out')
                ? 'Analysis timed out. The video may be too long or complex.'
                : 'Error analyzing video. The service may be temporarily unavailable.'
            })
            .eq('id', videoId);
        }

        // Add a delay between videos to avoid overwhelming the service
        if (i < videoIds.length - 1) {
          console.log('Waiting 5 seconds before processing the next video...');
          await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay
        }
      } catch (videoError: any) {
        console.error(`Error processing video ${videoId}:`, videoError.message);
        // Continue with the next video
      }
    }

    console.log('All videos have been processed');

    // Generate a recommendation based on all analyzed videos
    try {
      console.log('Generating recommendation based on all analyzed videos...');

      // Wait a moment to ensure all database updates are complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Call the generate-recommendation API
      const recommendationResponse = await fetch(new URL('/api/generate-recommendation', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          videoIds
        }),
      });

      if (!recommendationResponse.ok) {
        const errorData = await recommendationResponse.json();
        throw new Error(errorData.error || 'Failed to generate recommendation');
      }

      const recommendationData = await recommendationResponse.json();
      console.log('Recommendation generated successfully:', recommendationData.recommendation.id);

      // Send email notification if this is the first recommendation or it's been 24 hours
      try {
        // Get user data including email preferences
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('email_notifications, last_email_sent')
          .eq('id', userId)
          .single();

        if (userError) {
          throw new Error(`Error fetching user data: ${userError.message}`);
        }

        // Check if email notifications are enabled
        if (userData.email_notifications !== false) {
          // Check if this is the first recommendation or it's been 24 hours since the last email
          const lastEmailSent = userData.last_email_sent ? new Date(userData.last_email_sent) : null;
          const now = new Date();
          const hoursSinceLastEmail = lastEmailSent
            ? (now.getTime() - lastEmailSent.getTime()) / (1000 * 60 * 60)
            : 999; // Large number to ensure it passes the 24-hour check if no previous email

          if (!lastEmailSent || hoursSinceLastEmail >= 24) {
            // Get user's email from auth
            const { data: authData, error: authError } = await supabase.auth.admin.getUserById(userId);

            if (authError || !authData?.user?.email) {
              throw new Error(`Error fetching user email: ${authError?.message || 'No email found'}`);
            }

            // Get the recommendation details
            const { data: recommendations, error: recError } = await supabase
              .from('recommendations')
              .select('*')
              .eq('id', recommendationData.recommendation.id)
              .single();

            if (recError) {
              throw new Error(`Error fetching recommendation details: ${recError.message}`);
            }

            // Send the email
            await sendRecommendationEmail(
              authData.user.email,
              authData.user.user_metadata?.full_name || '',
              [recommendations]
            );

            // Update last_email_sent timestamp
            await supabase
              .from('users')
              .update({ last_email_sent: now.toISOString() })
              .eq('id', userId);

            console.log(`Email notification sent to ${authData.user.email}`);
          } else {
            console.log(`Skipping email notification - last email was sent ${hoursSinceLastEmail.toFixed(1)} hours ago`);
          }
        } else {
          console.log('Email notifications are disabled for this user');
        }
      } catch (emailError: any) {
        console.error('Error sending email notification:', emailError.message);
        // Continue even if email sending fails
      }
    } catch (recError: any) {
      console.error('Error generating recommendation:', recError.message);
      // Continue even if recommendation generation fails
    }

    return NextResponse.json({
      success: true,
      message: `Analysis completed for ${videoIds.length} videos`
    });
  } catch (error: any) {
    console.error('Error in direct-analysis API route:', error);

    return NextResponse.json(
      {
        error: error.message || 'An error occurred during video analysis',
        suggestion: 'Please try again later or contact support if the issue persists.'
      },
      { status: 500 }
    );
  }
}

// Server-side implementation of video analysis using OpenRouter's multimodal model
async function analyzeVideoWithOpenRouter(videoUrl: string) {
  try {
    console.log(`Starting analysis process for video using OpenRouter multimodal model: ${videoUrl}`);

    // Prepare the prompt for the multimodal model
    const prompt = `Analyze this TikTok video in detail. Please provide:
1. A comprehensive summary of what's happening in the video
2. Key visual elements and objects present
3. Any text or captions visible in the video
4. The overall theme or message of the content
5. What makes this content engaging or trending

Be specific and detailed in your analysis.`;

    console.log('Sending request to OpenRouter multimodal model...');

    // Get and sanitize the API key
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OpenRouter API key is missing');
    }

    // Sanitize the API key - remove any whitespace or invalid characters
    const sanitizedApiKey = apiKey.trim();

    // Log sanitized key info
    console.log('Original API key length:', apiKey.length);
    console.log('Sanitized API key length:', sanitizedApiKey.length);
    console.log('First 5 chars of sanitized key:', sanitizedApiKey.substring(0, 5) + '...');

    // Check for common issues
    if (sanitizedApiKey.includes(' ')) {
      console.error('API key contains spaces');
    }
    if (sanitizedApiKey.includes('\n') || sanitizedApiKey.includes('\r')) {
      console.error('API key contains newlines');
    }

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
                    url: videoUrl
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
                      url: videoUrl
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

    console.log('OpenRouter response received');

    // Extract the analysis from the response
    let analysis = response.data.choices[0]?.message?.content || 'No analysis available';
    console.log('Analysis summary:', analysis.substring(0, 100) + '...');

    // Ensure the analysis is a string and not undefined or null
    if (!analysis) {
      analysis = 'No analysis available';
    }

    // Return the analysis results
    return {
      summary: analysis,
      transcript: '', // No transcript available with this method
      frames_analysis: [] // No frame analysis available with this method
    };
  } catch (error: any) {
    console.error(`Error analyzing video with OpenRouter: ${videoUrl}`, error.message);
    if (error.response) {
      console.error('Error response status:', error.response.status);
      console.error('Error response data:', error.response.data);
    }

    // In case of API failure, return a basic summary
    return {
      summary: `Error analyzing video: ${error.message}`,
      transcript: '',
      frames_analysis: []
    };
  }
}
