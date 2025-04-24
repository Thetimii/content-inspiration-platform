import { NextResponse } from 'next/server';
import axios from 'axios';
import { supabase } from '@/utils/supabase';
import { sendRecommendationEmail } from '@/utils/brevoEmail';

/**
 * API endpoint to directly generate a recommendation from analyzed videos
 * This is a simplified version that doesn't use chained API calls
 */
export async function POST(request: Request) {
  try {
    const { userId, queryId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    console.log(`Generating recommendation for user ${userId}`);

    // Get all videos for this user, optionally filtered by query ID
    const videosQuery = supabase
      .from('tiktok_videos')
      .select('*, trend_queries(query)')
      .eq('trend_queries.user_id', userId)
      .order('likes', { ascending: false });

    // If a query ID is provided, filter by that query
    if (queryId) {
      videosQuery.eq('trend_query_id', queryId);
    }

    const { data: videos, error: videosError } = await videosQuery;

    if (videosError) {
      console.error('Error fetching videos:', videosError);
      return NextResponse.json(
        { error: 'Error fetching videos' },
        { status: 500 }
      );
    }

    if (!videos || videos.length === 0) {
      console.error('No videos found for this user');
      return NextResponse.json(
        { error: 'No videos found for this user' },
        { status: 404 }
      );
    }

    console.log(`Found ${videos.length} videos for recommendation generation`);

    // Filter videos that have been analyzed (have frame_analysis)
    let analyzedVideos = videos.filter(video => video.frame_analysis);

    if (analyzedVideos.length === 0) {
      console.log('No analyzed videos found, using all videos instead');
      analyzedVideos = videos;

      // Generate simple analyses for videos that don't have them
      for (const video of analyzedVideos) {
        if (!video.frame_analysis) {
          // Generate a simple analysis
          const simpleAnalysis = generateSimpleAnalysis(video);

          // Update the video in the database
          await supabase
            .from('tiktok_videos')
            .update({
              frame_analysis: simpleAnalysis,
              summary: simpleAnalysis.substring(0, 500) + '...',
              last_analyzed_at: new Date().toISOString()
            })
            .eq('id', video.id);

          // Update the video object
          video.frame_analysis = simpleAnalysis;
        }
      }
    }

    console.log(`Found ${analyzedVideos.length} analyzed videos for recommendation generation`);

    // Get the OpenRouter API key
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error('OpenRouter API key is missing');
      return NextResponse.json(
        { error: 'OpenRouter API key is missing' },
        { status: 500 }
      );
    }

    // Sanitize the API key
    const sanitizedApiKey = apiKey.trim();

    // Prepare the prompt for the recommendation
    const videoAnalyses = analyzedVideos.map(video => {
      return `Video ${video.id} (${video.trend_queries.query}): ${video.frame_analysis}`;
    }).join('\n\n');

    const prompt = `Based on the following TikTok video analyses, generate a comprehensive recommendation for creating trending content.

Video Analyses:
${videoAnalyses}

Please provide your recommendation in the following format:

# Video Analysis
[Provide a detailed analysis of the common patterns, themes, and techniques used in these trending videos]

# Cutting/Pacing Techniques
[List the specific editing techniques, transitions, and pacing patterns observed]

# Guide for Recreation
- [Step-by-step bullet points on how to recreate similar content]
- [Include specific technical advice]
- [Mention equipment or tools needed]

# Video Ideas
1. [Specific video idea 1]
2. [Specific video idea 2]
3. [Specific video idea 3]
4. [Specific video idea 4]
5. [Specific video idea 5]

Make your recommendations specific, actionable, and based directly on the patterns observed in the analyzed videos.`;

    console.log('Generating recommendation with OpenRouter...');

    // Make the API call to OpenRouter for recommendation generation
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'meta-llama/llama-4-maverick:free',
        messages: [
          {
            role: 'system',
            content: 'You are a TikTok content strategy expert. Analyze the provided video analyses and generate specific, actionable recommendations for creating trending content.'
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${sanitizedApiKey}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://lazy-trends.vercel.app',
          'X-Title': 'Lazy Trends',
          'Content-Type': 'application/json'
        }
      }
    );

    // Extract the recommendation from the response
    const recommendationText = response.data?.choices?.[0]?.message?.content || '';
    console.log(`Received recommendation, length: ${recommendationText.length} characters`);

    // Get the user's business description
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('business_description')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('Error fetching user data:', userError);
    }

    // Save the recommendation to the database
    const { data: savedRecommendation, error: saveError } = await supabase
      .from('recommendations')
      .insert({
        user_id: userId,
        content: recommendationText,
        business_type: userData?.business_description || 'Not specified',
        video_ids: analyzedVideos.map(v => v.id),
        created_at: new Date().toISOString()
      })
      .select();

    if (saveError) {
      console.error('Error saving recommendation:', saveError);
      return NextResponse.json(
        { error: `Error saving recommendation: ${saveError.message}` },
        { status: 500 }
      );
    }

    console.log('Recommendation saved successfully');

    // Send email notification if enabled
    try {
      // Get user data including email preferences
      const { data: userPrefs, error: prefsError } = await supabase
        .from('users')
        .select('email_notifications, last_email_sent')
        .eq('id', userId)
        .single();

      if (prefsError) {
        throw new Error(`Error fetching user preferences: ${prefsError.message}`);
      }

      // Check if email notifications are enabled
      if (userPrefs.email_notifications !== false) {
        // Check if this is the first recommendation or it's been 24 hours since the last email
        const lastEmailSent = userPrefs.last_email_sent ? new Date(userPrefs.last_email_sent) : null;
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

          // Send the email
          await sendRecommendationEmail(
            authData.user.email,
            authData.user.user_metadata?.full_name || '',
            [savedRecommendation[0]]
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

    return NextResponse.json({
      success: true,
      message: 'Recommendation generated successfully',
      recommendation: savedRecommendation[0]
    });
  } catch (error: any) {
    console.error('Error in direct-recommendation API route:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      responseStatus: error.response?.status,
      responseData: error.response?.data ? JSON.stringify(error.response.data).substring(0, 200) : 'No response data'
    });

    return NextResponse.json(
      {
        error: error.message || 'An error occurred during recommendation generation',
        suggestion: 'Please try again later or contact support if the issue persists.'
      },
      { status: 500 }
    );
  }
}

/**
 * Generate a simple analysis based on video metadata
 * This is used as a fallback when videos don't have analysis
 */
function generateSimpleAnalysis(video: any): string {
  const hashtags = Array.isArray(video.hashtags) ? video.hashtags.join(', ') : '';
  const views = video.views ? `${video.views.toLocaleString()} views` : 'Unknown views';
  const likes = video.likes ? `${video.likes.toLocaleString()} likes` : 'Unknown likes';

  return `# Video Analysis

## Content Overview
This TikTok video appears to be about ${video.caption || 'unknown content'}. The video has gained significant attention with ${views} and ${likes}.

## Hashtags Used
${hashtags ? `The creator used the following hashtags: ${hashtags}` : 'No hashtags were detected in this video.'}

## Visual Style
The video likely uses popular TikTok visual styles including quick cuts, on-screen text, and engaging visuals to maintain viewer attention.

## Audio Elements
The video likely includes background music, possibly voice narration, and sound effects to enhance engagement.

## Engagement Techniques
- Hook in the first 3 seconds to capture attention
- Clear call-to-action encouraging likes, comments, or shares
- Relatable or entertaining content that resonates with the target audience
- Trending sounds or effects to increase discoverability

## Cutting/Pacing Techniques
- Quick cuts between scenes to maintain viewer attention
- Jump cuts to remove dead space and keep the video concise
- Seamless transitions between different segments
- Strategic pauses for emphasis on key points

# Guide for Recreation
- Start with a strong hook in the first 3 seconds
- Keep the video concise and to the point
- Use trending sounds or effects
- Include on-screen text to emphasize key points
- End with a clear call-to-action
- Use relevant hashtags to increase discoverability

# Video Ideas
1. Create a response or duet to this video
2. Make a similar video with your own unique twist
3. Create a series expanding on the topic covered in this video
4. Develop a behind-the-scenes look at creating content like this
5. Create a tutorial teaching others how to make similar content`;
}
