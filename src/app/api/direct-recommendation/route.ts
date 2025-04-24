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

    // Get the user's business description
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('business_description')
      .eq('id', userId)
      .single();

    const businessDescription = userData?.business_description || 'food business';

    const prompt = `You are a TikTok content strategy expert specializing in food content. Based on the following TikTok video analyses, generate a comprehensive recommendation for a ${businessDescription}.

Video Analyses:
${videoAnalyses}

Focus on extracting SPECIFIC techniques, styles, and patterns from these actual videos. Don't provide generic advice - look at what's actually working in these trending videos and provide concrete recommendations based on them.

Please provide your recommendation in the following format:

# Content Patterns
[Identify 3-5 specific content patterns that appear across multiple trending videos. Be very specific about what types of food content is trending, what formats work best, and what specific hooks or angles are most effective.]

# Visual Techniques
[Describe 3-5 specific visual techniques used in these videos - camera angles, lighting, framing, colors, etc. Be specific about how food is presented visually.]

# Editing & Pacing
[Describe the specific editing style and pacing used in these trending videos - how long are clips, what transitions are used, how text is incorporated, etc.]

# Audio Strategy
[Describe the audio approach - voice narration style, music choices, sound effects, etc. that make these videos engaging]

# Step-by-Step Recreation Guide
1. [First step with specific details]
2. [Second step with specific details]
3. [Third step with specific details]
4. [Fourth step with specific details]
5. [Fifth step with specific details]

# 5 Video Ideas for ${businessDescription}
1. [Specific video idea tailored to this business]
2. [Specific video idea tailored to this business]
3. [Specific video idea tailored to this business]
4. [Specific video idea tailored to this business]
5. [Specific video idea tailored to this business]

Make your recommendations extremely specific, actionable, and tailored to a ${businessDescription}. Focus on what's actually shown in the analyzed videos, not generic TikTok advice.`;

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

  // Extract key information from the caption
  const caption = video.caption || '';
  const cleanCaption = caption.replace(/#\w+/g, '').trim(); // Remove hashtags

  // Try to identify the main subject/topic
  let topic = 'food preparation or recipe';
  if (cleanCaption.toLowerCase().includes('recipe')) {
    topic = 'a recipe';
  } else if (cleanCaption.toLowerCase().includes('cook')) {
    topic = 'cooking demonstration';
  } else if (cleanCaption.toLowerCase().includes('food')) {
    topic = 'food presentation';
  } else if (cleanCaption.toLowerCase().includes('eat') || cleanCaption.toLowerCase().includes('eating')) {
    topic = 'food tasting or eating';
  } else if (cleanCaption.toLowerCase().includes('restaurant') || cleanCaption.toLowerCase().includes('cafe')) {
    topic = 'restaurant or cafe visit';
  } else if (cleanCaption.toLowerCase().includes('review')) {
    topic = 'food review';
  }

  // Try to identify specific food items mentioned
  const foodItems = [];
  const commonFoodWords = ['pizza', 'burger', 'sandwich', 'taco', 'pasta', 'noodle', 'rice', 'chicken', 'beef', 'pork', 'fish', 'seafood', 'vegetable', 'fruit', 'dessert', 'cake', 'cookie', 'ice cream', 'coffee', 'tea', 'juice', 'smoothie', 'cocktail', 'drink'];

  for (const food of commonFoodWords) {
    if (cleanCaption.toLowerCase().includes(food)) {
      foodItems.push(food);
    }
  }

  const foodDescription = foodItems.length > 0
    ? `featuring ${foodItems.join(', ')}`
    : '';

  return `# Video Summary

## What's in the Video
This TikTok video shows ${topic} ${foodDescription}. Based on the caption "${cleanCaption}", the creator is likely demonstrating food preparation, showcasing a dish, or sharing a food experience.

## Video Statistics
The video has received ${views} and ${likes}, indicating its popularity among viewers.

## Hashtags
${hashtags ? `The creator used these hashtags to increase discoverability: ${hashtags}` : 'No hashtags were detected in this video.'}

## Visual Content
The video likely shows close-up shots of food preparation or the final dish, possibly with text overlays highlighting key ingredients or steps. The creator may appear in the video explaining the process or reacting to the food.

## Audio Elements
The audio probably includes either the creator's voice explaining the process, background music to enhance the mood, or trending TikTok sounds to increase engagement.

# Techniques Used
- Close-up shots of food to showcase details and textures
- Bright, well-lit scenes to make the food look appetizing
- Quick cuts between preparation steps to maintain viewer interest
- Text overlays to highlight key information
- Before and after comparisons of the cooking process
- Reaction shots showing enjoyment of the food

# Why This Video Works
- Food content is universally appealing and easy to engage with
- The video likely has a satisfying payoff showing the final dish
- The creator may use humor or personality to make the content more engaging
- The content is practical and potentially useful to viewers interested in food`;
}
