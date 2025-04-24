import { NextResponse } from 'next/server';
import axios from 'axios';
import { supabase } from '@/utils/supabase';

/**
 * API endpoint to get a clean, no-watermark download URL for a TikTok video
 * This is a separate function that can be called independently to check on the download URL
 */
export async function POST(request: Request) {
  try {
    const { videoId } = await request.json();

    if (!videoId) {
      return NextResponse.json(
        { error: 'Video ID is required' },
        { status: 400 }
      );
    }

    console.log(`Getting clean download URL for video ${videoId}`);

    // Get the video from the database
    const { data: video, error: videoError } = await supabase
      .from('tiktok_videos')
      .select('*')
      .eq('id', videoId)
      .single();

    if (videoError || !video) {
      console.error('Error fetching video:', videoError);
      return NextResponse.json(
        { error: 'Error fetching video or video not found' },
        { status: 404 }
      );
    }

    // Make sure we have a video URL
    if (!video.video_url) {
      return NextResponse.json(
        { error: 'No video URL available for this video' },
        { status: 400 }
      );
    }

    // Get the RapidAPI key
    const rapidApiKey = process.env.RAPIDAPI_KEY;
    if (!rapidApiKey) {
      return NextResponse.json(
        { error: 'RapidAPI key is missing' },
        { status: 500 }
      );
    }

    // Get a clean, no-watermark download URL from RapidAPI
    console.log(`Getting clean download URL for video: ${video.video_url}`);

    try {
      const rapidApiResponse = await axios.get(
        'https://tiktok-download-video1.p.rapidapi.com/getVideo',
        {
          params: {
            url: video.video_url,
            hd: '1'
          },
          headers: {
            'X-RapidAPI-Key': rapidApiKey,
            'X-RapidAPI-Host': 'tiktok-download-video1.p.rapidapi.com'
          }
        }
      );

      console.log('RapidAPI response received');

      // Extract the download URL from the response
      let downloadUrl = '';

      console.log('RapidAPI response structure:', JSON.stringify(rapidApiResponse.data, null, 2));

      // Try multiple possible response formats based on API documentation
      if (rapidApiResponse.data) {
        // Format 1: data.play
        if (rapidApiResponse.data.data && rapidApiResponse.data.data.play) {
          downloadUrl = rapidApiResponse.data.data.play;
        }
        // Format 2: data.video
        else if (rapidApiResponse.data.data && rapidApiResponse.data.data.video) {
          downloadUrl = rapidApiResponse.data.data.video;
        }
        // Format 3: video[0]
        else if (rapidApiResponse.data.video && Array.isArray(rapidApiResponse.data.video) && rapidApiResponse.data.video[0]) {
          downloadUrl = rapidApiResponse.data.video[0];
        }
        // Format 4: video (string)
        else if (typeof rapidApiResponse.data.video === 'string') {
          downloadUrl = rapidApiResponse.data.video;
        }
        // Format 5: nowm_video_url
        else if (rapidApiResponse.data.nowm_video_url) {
          downloadUrl = rapidApiResponse.data.nowm_video_url;
        }
        // Format 6: video_no_watermark
        else if (rapidApiResponse.data.video_no_watermark) {
          downloadUrl = rapidApiResponse.data.video_no_watermark;
        }
        // Format 7: direct video URL in response
        else if (typeof rapidApiResponse.data === 'string' && rapidApiResponse.data.includes('http')) {
          downloadUrl = rapidApiResponse.data;
        }
        // Format 8: hdplay
        else if (rapidApiResponse.data.data && rapidApiResponse.data.data.hdplay) {
          downloadUrl = rapidApiResponse.data.data.hdplay;
        }
        // Format 9: wmplay
        else if (rapidApiResponse.data.data && rapidApiResponse.data.data.wmplay) {
          downloadUrl = rapidApiResponse.data.data.wmplay;
        }
      }

      if (downloadUrl) {
        console.log(`Got clean download URL: ${downloadUrl}`);

        // Update the video record with the clean download URL
        await supabase
          .from('tiktok_videos')
          .update({ download_url: downloadUrl })
          .eq('id', videoId);

        // Verify the URL is accessible
        try {
          const testResponse = await axios.head(downloadUrl, {
            timeout: 10000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
          });
          console.log(`Download URL is accessible, status: ${testResponse.status}`);
        } catch (headError) {
          // If HEAD request fails, try a GET request instead
          console.log(`HEAD request failed, trying GET request`);
          try {
            const getResponse = await axios.get(downloadUrl, {
              timeout: 10000,
              responseType: 'arraybuffer',
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
              }
            });
            console.log(`GET request successful, status: ${getResponse.status}`);
          } catch (getError: any) {
            console.error('Both HEAD and GET requests failed, but continuing anyway');
            console.error('GET error:', getError.message || 'Unknown error');
          }
        }

        return NextResponse.json({
          success: true,
          message: 'Clean download URL obtained successfully',
          video_id: videoId,
          download_url: downloadUrl,
          original_url: video.video_url
        });
      } else {
        console.error('Could not extract download URL from RapidAPI response');
        console.error('Response structure:', JSON.stringify(rapidApiResponse.data, null, 2));

        // Try a second API endpoint as backup
        try {
          console.log('Trying alternative API endpoint...');
          const backupResponse = await axios.get(
            `https://tiktok-download-video1.p.rapidapi.com/getVideoInfo`,
            {
              params: {
                video_url: video.video_url
              },
              headers: {
                'X-RapidAPI-Key': rapidApiKey,
                'X-RapidAPI-Host': 'tiktok-download-video1.p.rapidapi.com'
              }
            }
          );

          console.log('Backup API response:', JSON.stringify(backupResponse.data, null, 2));

          // Try to extract URL from backup response
          if (backupResponse.data && backupResponse.data.no_watermark_url) {
            downloadUrl = backupResponse.data.no_watermark_url;
            console.log(`Got clean download URL from backup API: ${downloadUrl}`);

            // Update the video in the database
            await supabase
              .from('tiktok_videos')
              .update({
                download_url: downloadUrl
              })
              .eq('id', videoId);

            return NextResponse.json({
              success: true,
              message: 'Clean download URL obtained successfully from backup API',
              video_id: videoId,
              download_url: downloadUrl,
              original_url: video.video_url
            });
          }
        } catch (backupError) {
          console.error('Error with backup API call:', backupError);
        }

        // If we still don't have a URL, return an error
        return NextResponse.json(
          {
            error: 'Could not extract download URL from RapidAPI response',
            response_data: rapidApiResponse.data,
            video_url: video.video_url
          },
          { status: 500 }
        );
      }
    } catch (error: any) {
      console.error('Error getting clean download URL:', error);

      return NextResponse.json(
        {
          error: 'Error getting clean download URL',
          details: error.message || 'Unknown error',
          video_url: video.video_url,
          current_download_url: video.download_url || 'None'
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Unexpected error in get-clean-url route:', error);

    return NextResponse.json(
      { error: 'An unexpected error occurred', details: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
