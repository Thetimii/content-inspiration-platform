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
      if (rapidApiResponse.data && rapidApiResponse.data.data && rapidApiResponse.data.data.play) {
        downloadUrl = rapidApiResponse.data.data.play;
        console.log(`Got clean download URL: ${downloadUrl}`);
        
        // Update the video record with the download URL
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
          const getResponse = await axios.get(downloadUrl, {
            timeout: 10000,
            responseType: 'arraybuffer',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
          });
          console.log(`GET request successful, status: ${getResponse.status}`);
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
        console.error('Response:', JSON.stringify(rapidApiResponse.data, null, 2));
        
        return NextResponse.json(
          { 
            error: 'Could not extract download URL from RapidAPI response',
            response_data: rapidApiResponse.data
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
