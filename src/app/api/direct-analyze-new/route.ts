import { NextResponse } from 'next/server';
import axios from 'axios';
import { supabase } from '@/utils/supabase';

/**
 * API endpoint to directly analyze a single video
 * This version ensures we get a clean, no-watermark video URL before passing it to the AI
 *
 * IMPORTANT: This endpoint is responsible for:
 * 1. Getting a clean, no-watermark download URL from RapidAPI using the getVideo endpoint
 * 2. Updating the video record in the database with this clean URL
 * 3. Passing the clean URL to the OpenRouter API for analysis
 * 4. Saving the analysis results to the database
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

    // Get a clean, no-watermark video URL using the TikTok API
    // We'll use the video_url from our database to get a clean version
    if (!video.video_url) {
      console.error(`Video ${videoId} has no video URL`);
      return NextResponse.json(
        { error: 'No video URL available for this video' },
        { status: 400 }
      );
    }

    console.log(`Original video URL: ${video.video_url}`);
    console.log(`Original download URL: ${video.download_url || 'None'}`);

    // Extract the TikTok video ID from the URL or use a default approach
    let tiktokVideoId = '';
    try {
      // Try to extract from the URL
      const urlMatch = video.video_url.match(/\/video\/(\d+)/);
      if (urlMatch && urlMatch[1]) {
        tiktokVideoId = urlMatch[1];
      } else {
        // If we can't extract from URL, use the last part of the path
        const urlParts = new URL(video.video_url).pathname.split('/');
        tiktokVideoId = urlParts[urlParts.length - 1];
      }
    } catch (error) {
      console.error(`Error extracting TikTok video ID:`, error);
      // If all else fails, use the download_url if available
      if (video.download_url) {
        console.log(`Using existing download_url as fallback`);
      } else {
        return NextResponse.json(
          { error: 'Could not extract TikTok video ID' },
          { status: 400 }
        );
      }
    }

    console.log(`Extracted TikTok video ID: ${tiktokVideoId}`);

    // Get the RapidAPI key
    const rapidApiKey = process.env.RAPIDAPI_KEY;
    if (!rapidApiKey) {
      console.error('RapidAPI key is missing');
      return NextResponse.json(
        { error: 'RapidAPI key is missing' },
        { status: 500 }
      );
    }

    // Get a clean download URL from RapidAPI
    let cleanDownloadUrl = '';
    try {
      console.log(`Fetching clean download URL from RapidAPI for video ID: ${tiktokVideoId}`);

      // Use the exact endpoint and format from the example
      console.log(`Using video URL for RapidAPI: ${video.video_url}`);
      const rapidApiResponse = await axios.get(
        `https://tiktok-download-video1.p.rapidapi.com/getVideo`,
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

      console.log('RapidAPI response:', JSON.stringify(rapidApiResponse.data, null, 2));

      // Try multiple possible response formats based on API documentation
      if (rapidApiResponse.data) {
        // Format 1: data.play
        if (rapidApiResponse.data.data && rapidApiResponse.data.data.play) {
          cleanDownloadUrl = rapidApiResponse.data.data.play;
        }
        // Format 2: data.video
        else if (rapidApiResponse.data.data && rapidApiResponse.data.data.video) {
          cleanDownloadUrl = rapidApiResponse.data.data.video;
        }
        // Format 3: video[0]
        else if (rapidApiResponse.data.video && rapidApiResponse.data.video[0]) {
          cleanDownloadUrl = rapidApiResponse.data.video[0];
        }
        // Format 4: video (string)
        else if (typeof rapidApiResponse.data.video === 'string') {
          cleanDownloadUrl = rapidApiResponse.data.video;
        }
        // Format 5: nowm_video_url
        else if (rapidApiResponse.data.nowm_video_url) {
          cleanDownloadUrl = rapidApiResponse.data.nowm_video_url;
        }
        // Format 6: video_no_watermark
        else if (rapidApiResponse.data.video_no_watermark) {
          cleanDownloadUrl = rapidApiResponse.data.video_no_watermark;
        }
        // Format 7: direct video URL in response
        else if (typeof rapidApiResponse.data === 'string' && rapidApiResponse.data.includes('http')) {
          cleanDownloadUrl = rapidApiResponse.data;
        }
      }

      if (cleanDownloadUrl) {
        console.log(`Got clean download URL: ${cleanDownloadUrl}`);

        // Update the video in the database with the clean download URL
        await supabase
          .from('tiktok_videos')
          .update({
            download_url: cleanDownloadUrl
          })
          .eq('id', videoId);
      } else {
        console.error('No clean download URL found in RapidAPI response');
        console.error('RapidAPI response structure:', JSON.stringify(rapidApiResponse.data, null, 2));

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
            cleanDownloadUrl = backupResponse.data.no_watermark_url;
            console.log(`Got clean download URL from backup API: ${cleanDownloadUrl}`);

            // Update the video in the database
            await supabase
              .from('tiktok_videos')
              .update({
                download_url: cleanDownloadUrl
              })
              .eq('id', videoId);
          }
        } catch (backupError) {
          console.error('Error with backup API call:', backupError);
        }

        // If we still don't have a URL, fall back to the existing download_url if available
        if (!cleanDownloadUrl && video.download_url) {
          cleanDownloadUrl = video.download_url;
          console.log(`Falling back to existing download_url: ${cleanDownloadUrl}`);
        } else if (!cleanDownloadUrl) {
          return NextResponse.json(
            { error: 'Could not get a clean download URL' },
            { status: 500 }
          );
        }
      }
    } catch (error) {
      console.error('Error fetching clean download URL:', error);
      // Fall back to the existing download_url if available
      if (video.download_url) {
        cleanDownloadUrl = video.download_url;
        console.log(`Falling back to existing download_url after error: ${cleanDownloadUrl}`);
      } else {
        return NextResponse.json(
          { error: 'Failed to get clean download URL' },
          { status: 500 }
        );
      }
    }

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

    console.log(`Using clean download URL for analysis: ${cleanDownloadUrl}`);

    // Prepare a more structured prompt for better analysis
    const prompt = `Analyze this TikTok video in detail. Please provide:
1. A comprehensive summary of what's happening in the video
2. Key visual elements and objects present
3. Any text or captions visible in the video
4. The overall theme or message of the content
5. What makes this content engaging or trending

Be specific and detailed in your analysis.`;

    // Make the API call to OpenRouter for video analysis
    console.log(`Calling OpenRouter API for video ${videoId} using qwen/qwen-2.5-vl-72b-instruct model`);
    console.log(`API Key length: ${sanitizedApiKey.length} characters`);

    // Prepare the request payload
    const requestPayload = {
      model: 'qwen/qwen-2.5-vl-72b-instruct', // Using the powerful 72B parameter model
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt
            },
            {
              type: 'image_url',
              image_url: {
                url: cleanDownloadUrl
              }
            }
          ]
        }
      ]
    };

    console.log('Request payload:', JSON.stringify(requestPayload, null, 2));

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      requestPayload,
      {
        headers: {
          'Authorization': `Bearer ${sanitizedApiKey}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://lazy-trends.vercel.app',
          'X-Title': 'Lazy Trends',
          'Content-Type': 'application/json'
        },
        timeout: 120000 // 120 second timeout to give more time for analysis
      }
    );

    console.log('OpenRouter API response status:', response.status);
    console.log('OpenRouter API response headers:', JSON.stringify(response.headers, null, 2));
    console.log('OpenRouter API response data:', JSON.stringify(response.data, null, 2));

    // Extract the analysis from the response
    const analysis = response.data?.choices?.[0]?.message?.content || '';
    console.log(`Received analysis for video ${videoId}, length: ${analysis.length} characters`);

    // Check if we actually got a meaningful analysis
    if (!analysis || analysis.trim().length < 10) {
      console.error(`Empty or too short analysis received for video ${videoId}`);
      return NextResponse.json(
        {
          error: 'The API returned an empty or too short analysis',
          suggestion: 'This may be due to the model being unable to process the video properly. Please try again later.'
        },
        { status: 500 }
      );
    }

    // Update the video in the database with the analysis
    const { data: updatedVideo, error: updateError } = await supabase
      .from('tiktok_videos')
      .update({
        frame_analysis: analysis,
        summary: analysis.substring(0, 500) + (analysis.length > 500 ? '...' : ''),
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
      analysis
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
