import { NextResponse } from 'next/server';
import axios from 'axios';
import { supabase } from '@/utils/supabase';

/**
 * API endpoint to process queries and scrape videos
 * This is called after simple-trending to avoid timeouts
 */
export async function POST(request: Request) {
  try {
    const { userId, queryIds } = await request.json();

    if (!userId || !queryIds || !Array.isArray(queryIds) || queryIds.length === 0) {
      return NextResponse.json(
        { error: 'User ID and query IDs are required' },
        { status: 400 }
      );
    }

    console.log(`Processing ${queryIds.length} queries for user ${userId}`);

    // Get the queries from the database
    const { data: queries, error: queryError } = await supabase
      .from('trend_queries')
      .select('*')
      .in('id', queryIds)
      .eq('user_id', userId);

    if (queryError) {
      console.error('Error fetching queries:', queryError);
      return NextResponse.json(
        { error: 'Error fetching queries' },
        { status: 500 }
      );
    }

    if (!queries || queries.length === 0) {
      console.error('No queries found with the provided IDs');
      return NextResponse.json(
        { error: 'No queries found with the provided IDs' },
        { status: 404 }
      );
    }

    const allVideos: any[] = [];
    const videoIdsForAnalysis: string[] = [];

    // Process each query
    for (const query of queries) {
      try {
        // Scrape videos for this query
        const videos = await scrapeTikTokVideos(query.query);

        // Save up to 5 videos per hashtag to database
        const videosToSave = videos.slice(0, 5); // Take the first 5 videos
        console.log(`Saving ${videosToSave.length} videos for query: ${query.query}`);

        for (const video of videosToSave) {
          // Skip videos with missing required data
          if (!video.video_url) {
            console.warn('Skipping video with missing URL');
            continue;
          }

          const { data: videoData, error: videoError } = await supabase
            .from('tiktok_videos')
            .insert({
              trend_query_id: query.id,
              video_url: video.video_url,
              caption: video.caption || '',
              views: video.views || 0,
              likes: video.likes || 0,
              downloads: video.downloads || 0,
              hashtags: Array.isArray(video.hashtags) ? video.hashtags : [],
              cover_url: video.cover_url || '',
              download_url: video.download_url || '',
            })
            .select();

          if (videoError) {
            console.error('Error saving video:', videoError);
          } else if (videoData) {
            allVideos.push(videoData[0]);
            // Add video ID to the list for analysis
            videoIdsForAnalysis.push(videoData[0].id);
          }
        }
      } catch (scrapeError) {
        console.error(`Error scraping videos for query "${query.query}":`, scrapeError);
        // Continue with other queries even if one fails
      }
    }

    // Trigger video analysis for all videos we just scraped
    if (videoIdsForAnalysis.length > 0) {
      try {
        console.log(`Triggering analysis for ${videoIdsForAnalysis.length} videos...`);

        // Make a direct API call to trigger the analysis
        const analysisResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/analyze-one-by-one`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            videoIds: videoIdsForAnalysis
          }),
        });

        if (!analysisResponse.ok) {
          const errorData = await analysisResponse.json();
          console.error('Error from analyze-one-by-one:', errorData);
        } else {
          const analysisData = await analysisResponse.json();
          console.log('Analyze-one-by-one response:', analysisData);
        }

        console.log('Video analysis for all videos triggered directly');
      } catch (triggerError) {
        console.error('Error setting up analysis trigger:', triggerError);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Scraped and saved ${allVideos.length} videos for ${queries.length} queries`,
      videos: allVideos
    });
  } catch (error: any) {
    console.error('Error in process-queries API route:', error);

    return NextResponse.json(
      {
        error: error.message || 'An error occurred during query processing',
        suggestion: 'Please try again later or contact support if the issue persists.'
      },
      { status: 500 }
    );
  }
}

// Server-side implementation of TikTok video scraping
async function scrapeTikTokVideos(query: string) {
  try {
    // Use the exact endpoint and parameters as provided
    const response = await axios.get(
      'https://tiktok-download-video1.p.rapidapi.com/feedSearch',
      {
        params: {
          keywords: query,
          count: '20', // Request more videos to ensure we have at least 5 good ones
          cursor: '0',
          region: 'US',
          publish_time: '0',
          sort_type: '0'
        },
        headers: {
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
          'X-RapidAPI-Host': 'tiktok-download-video1.p.rapidapi.com'
        }
      }
    );

    console.log('TikTok API response structure:', JSON.stringify(response.data).substring(0, 200) + '...');

    // Process and return the video data
    // Map the response to match our expected format
    if (response.data && response.data.data && Array.isArray(response.data.data.videos)) {
      // Log the first video item to see its structure
      if (response.data.data.videos.length > 0) {
        console.log('First video item structure:', JSON.stringify(response.data.data.videos[0]).substring(0, 1000) + '...');
      }

      return response.data.data.videos.map((item: any) => ({
        video_url: item.play || item.wmplay || '',
        caption: item.title || '',
        views: parseInt(item.play_count || '0', 10),
        likes: parseInt(item.digg_count || '0', 10),
        downloads: parseInt(item.download_count || '0', 10),
        hashtags: item.title ? item.title.match(/#[\w]+/g) || [] : [],
        cover_url: item.cover || item.origin_cover || '',
        download_url: item.download || item.wmplay || item.play || '',
      }));
    }

    console.log('Unexpected API response structure, returning empty array');
    return [];
  } catch (error) {
    console.error('Error scraping TikTok videos on server:', error);
    return [];
  }
}
