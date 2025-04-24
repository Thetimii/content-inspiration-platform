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

    // Process only the first query immediately and return a response
    // The rest will be processed by chained API calls
    if (queries.length > 0) {
      // Start processing the first query in the background
      // We don't await this to avoid timeouts
      processQueryAndChain(queries, 0, userId).catch(error => {
        console.error('Error in background processing:', error);
      });
    }

    // Return immediately with a success response
    return NextResponse.json({
      success: true,
      message: `Started processing ${queries.length} queries for user ${userId}. Results will be saved automatically.`,
      status: 'processing'
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

// Process a single query and then chain to the next one
// Export this function so it can be imported by process-single-query
export async function processQueryAndChain(queries: any[], index: number, userId: string) {
  if (index >= queries.length) {
    console.log('All queries processed successfully');
    return;
  }

  const query = queries[index];
  const allVideos: any[] = [];
  const videoIdsForAnalysis: string[] = [];

  try {
    console.log(`Processing query ${index+1}/${queries.length}: "${query.query}"`);

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

    // Trigger video analysis for videos from this query
    if (videoIdsForAnalysis.length > 0) {
      try {
        console.log(`Triggering analysis for ${videoIdsForAnalysis.length} videos from query ${index+1}...`);

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
      } catch (triggerError) {
        console.error('Error setting up analysis trigger:', triggerError);
      }
    }

    // Update the query status in the database
    await supabase
      .from('trend_queries')
      .update({ status: 'processed' })
      .eq('id', query.id);

    // Wait 5 seconds before processing the next query
    console.log(`Waiting 5 seconds before processing the next query...`);
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Process the next query by making a new API call instead of continuing in this function
    // This prevents timeouts by breaking the work into smaller chunks
    if (index < queries.length - 1) {
      console.log(`Chaining to next query ${index+2}/${queries.length}`);

      // Make a direct API call to process the next query
      const nextQueryResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/process-single-query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          queries,
          currentIndex: index + 1
        }),
      });

      if (!nextQueryResponse.ok) {
        console.error('Error chaining to next query:', await nextQueryResponse.text());
      } else {
        console.log('Successfully chained to next query');
      }
    } else {
      console.log('All queries have been processed');

      // All queries are done, trigger recommendation generation
      try {
        // Get all video IDs for this user's queries
        const { data: allUserVideos } = await supabase
          .from('tiktok_videos')
          .select('id')
          .in('trend_query_id', queries.map(q => q.id));

        if (allUserVideos && allUserVideos.length > 0) {
          const allVideoIds = allUserVideos.map(v => v.id);

          // Trigger recommendation generation
          console.log(`Triggering recommendation generation for ${allVideoIds.length} videos`);

          const recommendationResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/generate-recommendation`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId,
              videoIds: allVideoIds
            }),
          });

          if (!recommendationResponse.ok) {
            console.error('Error triggering recommendation generation:', await recommendationResponse.text());
          } else {
            console.log('Successfully triggered recommendation generation');
          }
        }
      } catch (error) {
        console.error('Error triggering recommendation generation:', error);
      }
    }
  } catch (error) {
    console.error(`Error processing query "${query.query}":`, error);

    // Update the query status to error
    await supabase
      .from('trend_queries')
      .update({ status: 'error' })
      .eq('id', query.id);

    // Still try to process the next query
    if (index < queries.length - 1) {
      console.log(`Attempting to continue with next query despite error...`);
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Chain to the next query
      const nextQueryResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/process-single-query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          queries,
          currentIndex: index + 1
        }),
      });

      if (!nextQueryResponse.ok) {
        console.error('Error chaining to next query after error:', await nextQueryResponse.text());
      }
    }
  }
}

// Server-side implementation of TikTok video scraping
async function scrapeTikTokVideos(query: string) {
  try {
    console.log(`Scraping TikTok videos for query: "${query}"`);

    // Make sure we have a RapidAPI key
    const rapidApiKey = process.env.RAPIDAPI_KEY;
    if (!rapidApiKey) {
      console.error('RAPIDAPI_KEY is missing from environment variables');
      throw new Error('RapidAPI key is missing');
    }

    console.log(`Using RapidAPI key (length: ${rapidApiKey.length})`);

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
          'X-RapidAPI-Key': rapidApiKey,
          'X-RapidAPI-Host': 'tiktok-download-video1.p.rapidapi.com'
        }
      }
    );

    console.log(`Received response from TikTok API for query "${query}"`);
    console.log('Response status:', response.status);
    console.log('TikTok API response structure:', JSON.stringify({
      status: response.status,
      statusText: response.statusText,
      data: {
        code: response.data?.code,
        msg: response.data?.msg,
        processed: response.data?.processed,
        data: {
          videos_count: response.data?.data?.videos?.length || 0
        }
      }
    }));

    // Process and return the video data
    // Map the response to match our expected format
    if (response.data && response.data.data && Array.isArray(response.data.data.videos)) {
      // Log the first video item to see its structure
      if (response.data.data.videos.length > 0) {
        const firstVideo = response.data.data.videos[0];
        console.log('First video item structure:', JSON.stringify({
          id: firstVideo.id,
          title: firstVideo.title,
          play: firstVideo.play ? 'present' : 'missing',
          wmplay: firstVideo.wmplay ? 'present' : 'missing',
          download: firstVideo.download ? 'present' : 'missing',
          cover: firstVideo.cover ? 'present' : 'missing',
          origin_cover: firstVideo.origin_cover ? 'present' : 'missing',
          play_count: firstVideo.play_count,
          digg_count: firstVideo.digg_count
        }));
      }

      const mappedVideos = response.data.data.videos.map((item: any) => {
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

        // Log each mapped video to ensure we have the right data
        console.log(`Mapped video: ${JSON.stringify({
          video_url_length: mappedVideo.video_url.length,
          caption_length: mappedVideo.caption.length,
          views: mappedVideo.views,
          likes: mappedVideo.likes,
          hashtags: mappedVideo.hashtags,
          cover_url_length: mappedVideo.cover_url.length,
          download_url_length: mappedVideo.download_url.length
        })}`);

        return mappedVideo;
      });

      console.log(`Successfully mapped ${mappedVideos.length} videos for query "${query}"`);
      return mappedVideos;
    }

    console.log(`Unexpected API response structure for query "${query}", returning empty array`);
    return [];
  } catch (error: any) {
    console.error(`Error scraping TikTok videos for query "${query}":`, error.message);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      responseStatus: error.response?.status,
      responseData: error.response?.data ? JSON.stringify(error.response.data).substring(0, 200) : 'No response data'
    });
    return [];
  }
}
