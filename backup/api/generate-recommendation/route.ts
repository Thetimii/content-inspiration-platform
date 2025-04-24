import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';
import axios from 'axios';

// Generate a comprehensive recommendation based on analyzed videos
async function generateRecommendationFromVideos(userId: string, videoIds: string[]) {
  try {
    // Fetch all the analyzed videos
    const { data: videos, error: videosError } = await supabase
      .from('tiktok_videos')
      .select('*, trend_queries(query)')
      .in('id', videoIds)
      .order('likes', { ascending: false });

    if (videosError) {
      console.error('Error fetching videos for recommendation:', videosError);
      throw new Error('Failed to fetch videos for recommendation');
    }

    if (!videos || videos.length === 0) {
      throw new Error('No videos found for recommendation');
    }

    // Count how many videos have summaries
    const analyzedVideos = videos.filter(video => video.summary && !video.summary.includes('Analysis in progress'));
    console.log(`Found ${analyzedVideos.length} analyzed videos out of ${videos.length} total`);

    if (analyzedVideos.length === 0) {
      throw new Error('No analyzed videos found. Please wait for video analysis to complete.');
    }

    // Extract all hashtags and queries
    const allHashtags = new Set<string>();
    const allQueries = new Set<string>();

    analyzedVideos.forEach(video => {
      // Add hashtags
      if (video.hashtags && Array.isArray(video.hashtags)) {
        video.hashtags.forEach((tag: string) => allHashtags.add(tag));
      }

      // Add query
      if (video.trend_queries && video.trend_queries.query) {
        allQueries.add(video.trend_queries.query);
      }
    });

    // Prepare the prompt for OpenRouter
    const prompt = `
You are a TikTok trend analyst helping a content creator understand current trends and create content ideas.

I've analyzed ${analyzedVideos.length} trending TikTok videos related to the following topics:
${Array.from(allQueries).map(q => `- ${q}`).join('\n')}

Here are summaries of the top trending videos (${Math.min(analyzedVideos.length, 20)} out of ${analyzedVideos.length} total):
${analyzedVideos.slice(0, 20).map(video => `
VIDEO (${video.likes.toLocaleString()} likes, ${video.views.toLocaleString()} views)
Caption: ${video.caption}
Summary: ${video.summary}
`).join('\n')}

Based on this analysis, please provide a comprehensive report with the following clearly labeled sections:

## 📊 Video Analysis
Provide a detailed analysis of the videos, including common themes, content patterns, and what makes them successful. Analyze the visual style, audio choices, and presentation techniques.

## 🎬 Technical Breakdown
Analyze the technical aspects of these videos - typical length, editing style, transitions, lighting, camera angles, and any other production elements that contribute to their success.

## 📝 Content Creation Guide
Provide a step-by-step guide for creating similar content, including:
- Pre-production planning
- Filming techniques
- Editing approach
- Posting strategy

## 💡 5 Content Ideas
Provide 5 specific, detailed content ideas based on these trends. For each idea include:
- Concept title and description
- Key visual elements to include
- Script outline or talking points
- Hook ideas for the first 3 seconds

IMPORTANT FORMATTING INSTRUCTIONS:
1. DO NOT include any hashtags in your response
2. DO NOT use technical jargon - keep everything simple and easy to understand
3. Format your response with clear markdown headings, bullet points, and numbered lists for easy readability
4. Make your recommendations specific, actionable, and tailored to the analyzed content
5. Keep each section concise and focused
`;

    console.log('Sending recommendation request to OpenRouter...');

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

    // Make the API call to OpenRouter
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'meta-llama/llama-4-maverick:free',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sanitizedApiKey}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          'X-Title': 'Lazy Trends'
        }
      }
    );

    const recommendation = response.data.choices[0].message.content;
    console.log('Recommendation generated successfully');

    // Save the recommendation to the database
    // First try with video_ids
    let savedRecommendation;
    let saveError;

    try {
      const result = await supabase
        .from('recommendations')
        .insert({
          user_id: userId,
          combined_summary: recommendation,
          content_ideas: recommendation,
          video_ids: videoIds
        })
        .select()
        .single();

      savedRecommendation = result.data;
      saveError = result.error;
    } catch (error) {
      console.log('Error with video_ids, trying without it:', error);

      // If that fails, try without video_ids (in case the column doesn't exist yet)
      const result = await supabase
        .from('recommendations')
        .insert({
          user_id: userId,
          combined_summary: recommendation,
          content_ideas: recommendation
        })
        .select()
        .single();

      savedRecommendation = result.data;
      saveError = result.error;
    }

    if (saveError) {
      console.error('Error saving recommendation:', saveError);
      throw new Error('Failed to save recommendation');
    }

    return savedRecommendation;
  } catch (error: any) {
    console.error('Error generating recommendation:', error);
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const { userId, videoIds } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
      return NextResponse.json(
        { error: 'Video IDs array is required' },
        { status: 400 }
      );
    }

    console.log(`Generating recommendation for user ${userId} based on ${videoIds.length} videos`);

    // Generate the recommendation
    const recommendation = await generateRecommendationFromVideos(userId, videoIds);

    return NextResponse.json({
      success: true,
      recommendation
    });
  } catch (error: any) {
    console.error('Error in generate-recommendation API route:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred' },
      { status: 500 }
    );
  }
}
