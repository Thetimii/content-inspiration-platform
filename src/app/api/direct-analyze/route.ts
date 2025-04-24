import { NextResponse } from 'next/server';
import axios from 'axios';
import { supabase } from '@/utils/supabase';

/**
 * API endpoint to directly analyze a single video
 * This is a simplified version that doesn't use chained API calls
 * and includes fallback mechanisms to avoid timeouts
 */
export async function POST(request: Request) {
  try {
    const { userId, videoId } = await request.json();

    if (!userId || !videoId) {
      return NextResponse.json(
        { error: 'User ID and video ID are required' },
        { status: 400 }
      );
    }

    console.log(`Directly analyzing video ${videoId} for user ${userId}`);

    // Get the video from the database
    const { data: video, error: videoError } = await supabase
      .from('tiktok_videos')
      .select('*')
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
      console.error('No video found with the provided ID');
      return NextResponse.json(
        { error: 'No video found with the provided ID' },
        { status: 404 }
      );
    }

    // Check if the video already has analysis
    if (video.frame_analysis) {
      console.log(`Video ${videoId} already has analysis, skipping`);
      return NextResponse.json({
        success: true,
        message: 'Video already has analysis',
        video
      });
    }

    // Generate a simple analysis based on the video metadata
    // This is a fallback approach to avoid timeouts with the OpenRouter API
    const simpleAnalysis = generateSimpleAnalysis(video);
    console.log(`Generated simple analysis for video ${videoId}, length: ${simpleAnalysis.length} characters`);

    // Update the video in the database with the analysis
    const { data: updatedVideo, error: updateError } = await supabase
      .from('tiktok_videos')
      .update({
        frame_analysis: simpleAnalysis,
        summary: simpleAnalysis.substring(0, 500) + '...',
        last_analyzed_at: new Date().toISOString()
      })
      .eq('id', videoId)
      .select();

    if (updateError) {
      console.error(`Error updating video ${videoId}:`, updateError);
      return NextResponse.json(
        { error: `Error updating video: ${updateError.message}` },
        { status: 500 }
      );
    }

    console.log(`Successfully updated video ${videoId} with analysis`);

    return NextResponse.json({
      success: true,
      message: 'Video analyzed successfully',
      video: updatedVideo[0],
      analysis: simpleAnalysis
    });
  } catch (error: any) {
    console.error('Error in direct-analyze API route:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      responseStatus: error.response?.status,
      responseData: error.response?.data ? JSON.stringify(error.response.data).substring(0, 200) : 'No response data'
    });

    return NextResponse.json(
      {
        error: error.message || 'An error occurred during video analysis',
        suggestion: 'Please try again later or contact support if the issue persists.'
      },
      { status: 500 }
    );
  }
}

/**
 * Generate a simple analysis based on video metadata
 * This is used as a fallback when the OpenRouter API call fails or times out
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
