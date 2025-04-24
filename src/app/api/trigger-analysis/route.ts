import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';
import { sendRecommendationEmail } from '@/utils/brevoEmail';

/**
 * API endpoint to trigger video analysis in a separate request
 * This helps avoid timeouts in the main trending-queries endpoint
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

    // Process videos one by one to avoid overwhelming the service
    for (let i = 0; i < videoIds.length; i++) {
      const videoId = videoIds[i];
      console.log(`Processing video ${i+1}/${videoIds.length}: ${videoId}`);

      try {
        // Get the video URL and last_analyzed_at timestamp
        const { data: videoData, error: videoError } = await supabase
          .from('tiktok_videos')
          .select('video_url, last_analyzed_at')
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

        console.log(`Starting analysis for video URL: ${videoData.video_url}`);

        // Set a flag in the database to indicate analysis is in progress
        await supabase
          .from('tiktok_videos')
          .update({ summary: 'Analysis in progress...' })
          .eq('id', videoId);

        // Run the analysis with OpenRouter multimodal model
        try {
          // Get the download URL if available
          const { data: videoWithDownloadUrl, error: downloadUrlError } = await supabase
            .from('tiktok_videos')
            .select('download_url')
            .eq('id', videoId)
            .single();

          if (downloadUrlError || !videoWithDownloadUrl.download_url) {
            console.log(`No download URL found for video ${videoId}, using video_url instead`);
          }

          // Use download_url if available, otherwise fall back to video_url
          const urlToAnalyze = videoWithDownloadUrl?.download_url || videoData.video_url;
          console.log(`Using URL for analysis: ${urlToAnalyze}`);

          // Import the analyzeVideoWithOpenRouter function
          const { analyzeVideoWithOpenRouter } = await import('../analyze-video-openrouter/route');

          // Set a timeout for the entire analysis process (10 minutes)
          const analysisPromise = analyzeVideoWithOpenRouter(urlToAnalyze);

          // Create a timeout promise
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Analysis timed out after 10 minutes')), 10 * 60 * 1000);
          });

          // Race the analysis against the timeout
          const analysis = await Promise.race([analysisPromise, timeoutPromise]) as {
            summary: string;
            transcript: string;
            frames_analysis: any[];
          };

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

          // If that succeeded, update the other fields
          if (!updateError) {
            await supabase
              .from('tiktok_videos')
              .update({
                transcript: analysis.transcript || '',
                frame_analysis: analysis.frames_analysis && analysis.frames_analysis.length > 0
                  ? JSON.stringify(analysis.frames_analysis[0])
                  : null
              })
              .eq('id', videoId);
          }

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
          console.log('Waiting 10 seconds before processing the next video...');
          await new Promise(resolve => setTimeout(resolve, 10000)); // 10 second delay
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
      message: `Analysis triggered for ${videoIds.length} videos`
    });
  } catch (error: any) {
    console.error('Error in trigger-analysis API route:', error);

    return NextResponse.json(
      {
        error: error.message || 'An error occurred during video analysis',
        suggestion: 'Please try again later or contact support if the issue persists.'
      },
      { status: 500 }
    );
  }
}
