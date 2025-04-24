import { NextResponse } from 'next/server';
import axios from 'axios';
import { supabase } from '@/utils/supabase';

/**
 * API endpoint to directly analyze a single video
 * This version handles Vercel's timeout limitations by starting the analysis
 * and immediately returning a response, then updating the database when complete
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

    console.log(`Analyzing video ${videoId} for user ${userId}`);

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

    // Check if the video already has analysis
    if (video.frame_analysis) {
      console.log(`Video ${videoId} already has analysis, returning existing analysis`);
      return NextResponse.json({
        success: true,
        message: 'Video already has analysis',
        video,
        analysis: video.frame_analysis
      });
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

    // Step 1: Get a clean, no-watermark download URL from RapidAPI
    console.log(`Getting clean download URL for video: ${video.video_url}`);

    let downloadUrl = '';
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

        // Update the video record with the download URL
        await supabase
          .from('tiktok_videos')
          .update({ download_url: downloadUrl })
          .eq('id', videoId);
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
          }
        } catch (backupError: any) {
          console.error('Error with backup API call:', backupError);
          console.error('Backup API error details:', backupError.message || 'Unknown error');
        }

        // If we still don't have a URL, fall back to the existing download_url or video_url
        if (!downloadUrl) {
          downloadUrl = video.download_url || video.video_url;
          console.log(`Falling back to: ${downloadUrl}`);
        }
      }
    } catch (error: any) {
      console.error('Error getting clean download URL:', error);
      console.error('Error details:', error.message || 'Unknown error');
      downloadUrl = video.download_url || video.video_url;
      console.log(`Error occurred, falling back to: ${downloadUrl}`);
    }

    if (!downloadUrl) {
      return NextResponse.json(
        { error: 'Could not get a valid download URL for the video' },
        { status: 500 }
      );
    }

    // Update the video status to indicate analysis is in progress
    await supabase
      .from('tiktok_videos')
      .update({
        frame_analysis: 'Analysis in progress...',
        last_analyzed_at: new Date().toISOString()
      })
      .eq('id', videoId);

    // Start the analysis process in the background without waiting for it to complete
    // This prevents Vercel's 10-second timeout from being triggered
    analyzeVideoInBackground(videoId, downloadUrl);

    // Return a response immediately
    return NextResponse.json({
      success: true,
      message: 'Video analysis started',
      video_id: videoId,
      status: 'processing'
    });

  } catch (error: any) {
    console.error('Unexpected error in direct-analyze-new route:', error);

    return NextResponse.json(
      { error: 'An unexpected error occurred', details: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Analyze a video in the background and update the database when complete
 * This function runs independently of the HTTP request/response cycle
 */
async function analyzeVideoInBackground(videoId: string, downloadUrl: string) {
  try {
    console.log(`Starting background analysis for video ${videoId}`);

    // Ensure the storage bucket exists
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      const bucketExists = buckets?.some(bucket => bucket.name === 'tiktok-videos') || false;

      if (!bucketExists) {
        console.log('Creating tiktok-videos storage bucket');
        const { error } = await supabase.storage.createBucket('tiktok-videos', {
          public: true,
          fileSizeLimit: 52428800, // 50MB
          allowedMimeTypes: ['video/mp4']
        });

        if (error) {
          console.error('Error creating storage bucket:', error);
        } else {
          console.log('Storage bucket created successfully');
        }
      } else {
        console.log('Storage bucket tiktok-videos already exists');
      }
    } catch (bucketError: any) {
      console.error('Error checking/creating storage bucket:', bucketError);
      console.error('Will attempt to continue anyway');
    }

    // Get the OpenRouter API key
    const openRouterApiKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterApiKey) {
      console.error('OpenRouter API key is missing');
      await updateVideoWithError(videoId, 'OpenRouter API key is missing');
      return;
    }

    // Prepare the prompt for video analysis
    const prompt = `Analyze this TikTok video in detail. Please provide:
1. A comprehensive summary of what's happening in the video
2. Key visual elements and objects present
3. Any text or captions visible in the video
4. The overall theme or message of the content
5. What makes this content engaging or trending

Be specific and detailed in your analysis.`;

    try {
      console.log(`Calling OpenRouter API for video ${videoId}`);

      // First, verify that the download URL is accessible
      try {
        console.log(`Verifying download URL is accessible: ${downloadUrl}`);

        // Try to get a fresh download URL from the database first
        console.log(`Getting fresh video data from database`);
        const { data: freshVideo } = await supabase
          .from('tiktok_videos')
          .select('video_url, download_url')
          .eq('id', videoId)
          .single();

        if (freshVideo && freshVideo.download_url && freshVideo.download_url !== downloadUrl) {
          console.log(`Found different download URL in database: ${freshVideo.download_url}`);
          downloadUrl = freshVideo.download_url;
        }

        // Now test the URL
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
      } catch (urlError: any) {
        console.error(`Download URL is not accessible: ${downloadUrl}`);
        console.error(`Error: ${urlError.message}`);

        // Instead of throwing an error, update the video with an error message and return
        await updateVideoWithError(videoId, `Video URL is not accessible: ${urlError.message}`);
        return;
      }

      // Download the video file to Supabase storage
      console.log(`Downloading video file from ${downloadUrl} to Supabase storage`);

      let supabaseFileUrl = '';
      let fileKey = '';

      try {
        // Download the video file
        console.log(`Starting download of video file from: ${downloadUrl}`);
        let videoBuffer;

        try {
          const response = await axios.get(downloadUrl, {
            responseType: 'arraybuffer',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 60000 // 60 second timeout for download
          });

          videoBuffer = response.data;
          console.log(`Video file downloaded successfully, size: ${videoBuffer.byteLength} bytes`);
        } catch (downloadError: any) {
          console.error(`Error downloading video file: ${downloadError.message}`);
          console.error('Download error details:', downloadError);
          throw new Error(`Failed to download video file: ${downloadError.message}`);
        }

        if (!videoBuffer || videoBuffer.byteLength === 0) {
          throw new Error('Downloaded video file is empty');
        }

        // Generate a unique file name
        fileKey = `temp-videos/${videoId}-${Date.now()}.mp4`;
        console.log(`Generated file key: ${fileKey}`);

        // Upload the file to Supabase storage
        console.log(`Uploading ${videoBuffer.byteLength} bytes to Supabase storage...`);
        try {
          const { error: uploadError } = await supabase.storage
            .from('tiktok-videos')
            .upload(fileKey, videoBuffer, {
              contentType: 'video/mp4',
              cacheControl: '3600'
            });

          if (uploadError) {
            console.error(`Error uploading to Supabase storage: ${uploadError.message}`);
            console.error('Upload error details:', uploadError);
            throw new Error(`Error uploading to Supabase storage: ${uploadError.message}`);
          }

          console.log(`Video file uploaded successfully to Supabase storage: ${fileKey}`);
        } catch (uploadError: any) {
          console.error(`Error during Supabase upload: ${uploadError.message}`);
          console.error('Upload error stack:', uploadError.stack);
          throw new Error(`Failed to upload to Supabase: ${uploadError.message}`);
        }

        // Get the public URL for the file
        console.log(`Getting public URL for file: ${fileKey}`);
        try {
          const { data: publicUrlData } = supabase.storage
            .from('tiktok-videos')
            .getPublicUrl(fileKey);

          if (!publicUrlData || !publicUrlData.publicUrl) {
            throw new Error('Failed to get public URL from Supabase');
          }

          supabaseFileUrl = publicUrlData.publicUrl;
          console.log(`Public URL for video file: ${supabaseFileUrl}`);

          // Verify the public URL is accessible
          try {
            console.log(`Verifying public URL is accessible: ${supabaseFileUrl}`);
            const urlCheckResponse = await axios.head(supabaseFileUrl, {
              timeout: 10000,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
              }
            });
            console.log(`Public URL is accessible, status: ${urlCheckResponse.status}`);
          } catch (urlCheckError: any) {
            console.warn(`Warning: Could not verify public URL accessibility: ${urlCheckError.message}`);
            console.warn('Will attempt to continue anyway');
          }
        } catch (publicUrlError: any) {
          console.error(`Error getting public URL: ${publicUrlError.message}`);
          throw new Error(`Failed to get public URL: ${publicUrlError.message}`);
        }

        // Now proceed with the OpenRouter API call using the Supabase file URL
        console.log(`Sending request to OpenRouter API with model: anthropic/claude-3-sonnet-20240229`);
        console.log(`Using Supabase file URL: ${supabaseFileUrl}`);

        // Prepare the request payload
        // Try with Claude 3 Opus Vision model instead of Qwen
        // Let's try a different approach - use Claude 3 Sonnet instead of Opus
        // It's more reliable for video analysis
        console.log('Preparing request payload for Claude 3 Sonnet');

        const requestPayload = {
          model: 'anthropic/claude-3-sonnet-20240229',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: supabaseFileUrl,
                    detail: 'high'
                  }
                }
              ]
            }
          ],
          max_tokens: 4000
        };

        // Prepare the headers
        const headers = {
          'Authorization': `Bearer ${openRouterApiKey.trim()}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://lazy-trends.vercel.app',
          'X-Title': 'Lazy Trends',
          'Content-Type': 'application/json'
        };

        console.log('OpenRouter request payload:', JSON.stringify(requestPayload, null, 2));
        console.log('OpenRouter request headers:', JSON.stringify(headers, null, 2));

        // Variable to store the response
        let openRouterResponse;

        try {
          console.log('Making OpenRouter API call...');
          openRouterResponse = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            requestPayload,
            {
              headers,
              timeout: 120000 // 2 minute timeout
            }
          );

          console.log('OpenRouter API call successful!');
          console.log('Response status:', openRouterResponse.status);
          console.log('Response headers:', JSON.stringify(openRouterResponse.headers, null, 2));
          console.log('Response data:', JSON.stringify(openRouterResponse.data, null, 2));
          console.log('OpenRouter API response received');
        } catch (openRouterError: any) {
          console.error('Error calling OpenRouter API:', openRouterError);
          console.error('Error details:', {
            message: openRouterError.message || 'Unknown error',
            status: openRouterError.response?.status,
            data: openRouterError.response?.data
          });
          throw openRouterError;
        }

        if (!openRouterResponse || !openRouterResponse.data) {
          throw new Error('No response received from OpenRouter API');
        }

        // Extract the analysis from the response
        const analysis = openRouterResponse.data?.choices?.[0]?.message?.content || '';

        if (!analysis || analysis.length < 10) {
          console.error('Empty or too short analysis received');
          await updateVideoWithError(videoId, 'The AI model returned an empty or too short analysis');
          return;
        }

        console.log(`Analysis received for video ${videoId}, length: ${analysis.length} characters`);

        // Update the video with the analysis
        const { error: updateError } = await supabase
          .from('tiktok_videos')
          .update({
            frame_analysis: analysis,
            summary: analysis.substring(0, 500) + (analysis.length > 500 ? '...' : ''),
            last_analyzed_at: new Date().toISOString()
          })
          .eq('id', videoId);

        if (updateError) {
          console.error('Error updating video with analysis:', updateError);
          return;
        }

        console.log(`Successfully updated video ${videoId} with analysis`);

        // Delete the temporary file from Supabase storage
        console.log(`Deleting temporary file from Supabase storage: ${fileKey}`);
        const { error: deleteError } = await supabase.storage
          .from('tiktok-videos')
          .remove([fileKey]);

        if (deleteError) {
          console.error(`Error deleting temporary file: ${deleteError.message}`);
        } else {
          console.log(`Successfully deleted temporary file: ${fileKey}`);
        }
      } catch (fileError: any) {
        console.error('Error processing video file:', fileError);
        console.error('Error details:', fileError.message || 'Unknown error');
        await updateVideoWithError(videoId, `Error processing video file: ${fileError.message || 'Unknown error'}`);

        // Try to delete the file if it was uploaded
        if (fileKey) {
          try {
            await supabase.storage
              .from('tiktok-videos')
              .remove([fileKey]);
            console.log(`Cleaned up temporary file after error: ${fileKey}`);
          } catch (cleanupError) {
            console.error('Error cleaning up temporary file:', cleanupError);
          }
        }
      }

    } catch (error: any) {
      console.error('Error analyzing video with OpenRouter:', error);
      console.error('Error details:', {
        message: error.message || 'Unknown error',
        status: error.response?.status,
        data: error.response?.data
      });

      await updateVideoWithError(videoId, `Error analyzing video: ${error.message || 'Unknown error'}`);
    }
  } catch (error: any) {
    console.error('Unexpected error in background analysis:', error);
    await updateVideoWithError(videoId, 'An unexpected error occurred during analysis');
  }
}

/**
 * Update a video with an error message
 */
async function updateVideoWithError(videoId: string, errorMessage: string) {
  try {
    await supabase
      .from('tiktok_videos')
      .update({
        frame_analysis: `Analysis failed: ${errorMessage}`,
        last_analyzed_at: new Date().toISOString()
      })
      .eq('id', videoId);

    console.log(`Updated video ${videoId} with error message`);
  } catch (error: any) {
    console.error('Error updating video with error message:', error);
  }
}
