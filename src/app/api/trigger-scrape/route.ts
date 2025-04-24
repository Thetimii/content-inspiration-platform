import { NextResponse } from 'next/server';
import axios from 'axios';
import { supabase } from '@/utils/supabase';

/**
 * API endpoint to directly trigger scraping for a specific query
 * This is a simplified version that doesn't use chained API calls
 */
export async function POST(request: Request) {
  try {
    const { userId, queryId } = await request.json();

    if (!userId || !queryId) {
      return NextResponse.json(
        { error: 'User ID and query ID are required' },
        { status: 400 }
      );
    }

    console.log(`Directly scraping videos for query ID ${queryId} for user ${userId}`);

    // Get the query from the database
    const { data: query, error: queryError } = await supabase
      .from('trend_queries')
      .select('*')
      .eq('id', queryId)
      .eq('user_id', userId)
      .single();

    if (queryError) {
      console.error('Error fetching query:', queryError);
      return NextResponse.json(
        { error: 'Error fetching query' },
        { status: 500 }
      );
    }

    if (!query) {
      console.error('No query found with the provided ID');
      return NextResponse.json(
        { error: 'No query found with the provided ID' },
        { status: 404 }
      );
    }

    // Scrape videos for this query
    console.log(`Scraping TikTok videos for query: "${query.query}"`);
    
    // Make sure we have a RapidAPI key
    const rapidApiKey = process.env.RAPIDAPI_KEY;
    if (!rapidApiKey) {
      console.error('RAPIDAPI_KEY is missing from environment variables');
      return NextResponse.json(
        { error: 'RapidAPI key is missing' },
        { status: 500 }
      );
    }

    console.log(`Using RapidAPI key (length: ${rapidApiKey.length})`);

    // Use the exact endpoint and parameters as provided
    const response = await axios.get(
      'https://tiktok-download-video1.p.rapidapi.com/feedSearch',
      {
        params: {
          keywords: query.query,
          count: '20', // Request more videos to ensure we have at least 5 good ones
          cursor: '0',
          region: 'US',
          publish_time: '0',
          sort_type: '0'
        },
        headers: {
          'X-RapidAPI-Key': rapidApiKey,
          'X-RapidAPI-Host': 'tiktok-download-video1.p.rapidapi.com'
        }
      }
    );

    console.log(`Received response from TikTok API for query "${query.query}"`);
    console.log('Response status:', response.status);

    // Process and return the video data
    const allVideos: any[] = [];
    const videoIdsForAnalysis: string[] = [];

    if (response.data && response.data.data && Array.isArray(response.data.data.videos)) {
      const videos = response.data.data.videos;
      console.log(`Found ${videos.length} videos for query "${query.query}"`);

      // Save up to 5 videos per hashtag to database
      const videosToSave = videos.slice(0, 5); // Take the first 5 videos
      console.log(`Saving ${videosToSave.length} videos for query: ${query.query}`);

      for (const item of videosToSave) {
        const mappedVideo = {
          video_url: item.play || item.wmplay || '',
          caption: item.title || '',
          views: parseInt(item.play_count || '0', 10),
          likes: parseInt(item.digg_count || '0', 10),
          downloads: parseInt(item.download_count || '0', 10),
          hashtags: item.title ? item.title.match(/#[\w]+/g) || [] : [],
          cover_url: item.cover || item.origin_cover || '',
          download_url: item.download || item.wmplay || item.play || '',
        };

        // Skip videos with missing required data
        if (!mappedVideo.video_url) {
          console.warn('Skipping video with missing URL');
          continue;
        }

        const { data: videoData, error: videoError } = await supabase
          .from('tiktok_videos')
          .insert({
            trend_query_id: query.id,
            video_url: mappedVideo.video_url,
            caption: mappedVideo.caption || '',
            views: mappedVideo.views || 0,
            likes: mappedVideo.likes || 0,
            downloads: mappedVideo.downloads || 0,
            hashtags: Array.isArray(mappedVideo.hashtags) ? mappedVideo.hashtags : [],
            cover_url: mappedVideo.cover_url || '',
            download_url: mappedVideo.download_url || '',
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

      // Update the query status in the database
      await supabase
        .from('trend_queries')
        .update({ status: 'processed' })
        .eq('id', query.id);

      // Trigger video analysis for videos from this query
      if (videoIdsForAnalysis.length > 0) {
        try {
          console.log(`Triggering analysis for ${videoIdsForAnalysis.length} videos...`);

          // Make a direct API call to trigger the analysis
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          console.log(`Using base URL for analyze-one-by-one: ${baseUrl}`);
          
          const analysisResponse = await fetch(`${baseUrl}/api/analyze-one-by-one`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId,
              videoIds: videoIdsForAnalysis
            }),
          });

          console.log(`Analysis response status: ${analysisResponse.status}`);
          
          if (!analysisResponse.ok) {
            const errorText = await analysisResponse.text();
            console.error(`Error from analyze-one-by-one (status ${analysisResponse.status}):`, errorText);
          } else {
            const analysisData = await analysisResponse.json();
            console.log('Analyze-one-by-one response:', analysisData);
          }
        } catch (triggerError) {
          console.error('Error setting up analysis trigger:', triggerError);
        }
      }

      return NextResponse.json({
        success: true,
        message: `Scraped and saved ${allVideos.length} videos for query "${query.query}"`,
        videos: allVideos,
        videoIdsForAnalysis
      });
    } else {
      console.log(`Unexpected API response structure for query "${query.query}", returning empty array`);
      return NextResponse.json({
        success: false,
        message: `No videos found for query "${query.query}"`,
        videos: [],
        videoIdsForAnalysis: []
      });
    }
  } catch (error: any) {
    console.error('Error in trigger-scrape API route:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      responseStatus: error.response?.status,
      responseData: error.response?.data ? JSON.stringify(error.response.data).substring(0, 200) : 'No response data'
    });

    return NextResponse.json(
      {
        error: error.message || 'An error occurred during video scraping',
        suggestion: 'Please try again later or contact support if the issue persists.'
      },
      { status: 500 }
    );
  }
}
