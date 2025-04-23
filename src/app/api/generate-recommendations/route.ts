import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';
import axios from 'axios';

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Get user profile
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('Error fetching user profile:', userError);
      return NextResponse.json(
        { error: 'Failed to fetch user profile' },
        { status: 500 }
      );
    }

    // Get video summaries
    const { data: videos, error: videosError } = await supabase
      .from('tiktok_videos')
      .select('*, trend_queries(query)')
      .not('summary', 'is', null)
      .order('likes', { ascending: false })
      .limit(20);

    if (videosError) {
      console.error('Error fetching videos:', videosError);
      return NextResponse.json(
        { error: 'Failed to fetch videos' },
        { status: 500 }
      );
    }

    // Combine summaries
    const videoSummaries = videos.map((video: any) => ({
      query: video.trend_queries?.query,
      caption: video.caption,
      likes: video.likes,
      views: video.views,
      summary: video.summary,
      hashtags: video.hashtags,
    }));

    // Generate recommendations using OpenRouter
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'google/gemma-3-4b-it:free',
        messages: [
          {
            role: 'system',
            content: 'You are a social media growth expert helping businesses create content for TikTok. Analyze the trending videos and provide recommendations.'
          },
          {
            role: 'user',
            content: `
              I run a business described as: "${userData.business_description}"

              My experience level is: ${userData.social_media_experience}
              I can commit ${userData.weekly_time_commitment} hours per week to content creation.

              Here are summaries of trending TikTok videos in my niche:
              ${JSON.stringify(videoSummaries, null, 2)}

              Please provide:
              1. A combined summary of what's trending in my niche
              2. Specific content ideas I should create for my business
            `
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://lazy-trends.vercel.app',
          'X-Title': 'Lazy Trends',
          'Content-Type': 'application/json'
        }
      }
    );

    const content = response.data.choices[0]?.message?.content || '';

    // Extract the combined summary and content ideas
    let combinedSummary = '';
    let contentIdeas = '';

    try {
      const sections = content.split(/\d+\.\s+/);
      combinedSummary = sections[1]?.trim() || 'No trend summary available';
      contentIdeas = sections[2]?.trim() || 'No content ideas available';
    } catch (error) {
      console.error('Error parsing AI response:', error);
      combinedSummary = 'Error parsing trend summary';
      contentIdeas = 'Error parsing content ideas';
    }

    // Save recommendations to database
    const { data, error } = await supabase
      .from('recommendations')
      .insert({
        user_id: userId,
        combined_summary: combinedSummary,
        content_ideas: contentIdeas,
      })
      .select();

    if (error) {
      console.error('Error saving recommendations:', error);
      return NextResponse.json(
        { error: 'Failed to save recommendations' },
        { status: 500 }
      );
    }

    return NextResponse.json({ recommendations: data[0] });
  } catch (error: any) {
    console.error('Error generating recommendations:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred' },
      { status: 500 }
    );
  }
}
