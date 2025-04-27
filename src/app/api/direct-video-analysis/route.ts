import { NextResponse } from 'next/server';
import axios from 'axios';
import { supabase } from '@/utils/supabase';

/**
 * API endpoint to analyze a TikTok video using Alibaba Cloud DashScope API
 * This implementation follows the exact approach from the video analyzer project
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

    console.log(`[DIRECT-ANALYSIS] Starting analysis for video ${videoId} and user ${userId}`);

    // Get the video from the database
    const { data: video, error: videoError } = await supabase
      .from('tiktok_videos')
      .select('*')
      .eq('id', videoId)
      .single();

    if (videoError || !video) {
      console.error(`[DIRECT-ANALYSIS] Error fetching video ${videoId}:`, videoError);
      return NextResponse.json(
        { error: 'Error fetching video or video not found' },
        { status: 404 }
      );
    }

    // Check if the video already has analysis
    if (video.frame_analysis && video.frame_analysis !== 'Analysis in progress...') {
      console.log(`[DIRECT-ANALYSIS] Video ${videoId} already has analysis, returning existing analysis`);
      return NextResponse.json({
        success: true,
        message: 'Video already has analysis',
        video,
        analysis: video.frame_analysis
      });
    }

    // Make sure we have a video URL
    if (!video.video_url && !video.download_url) {
      console.error(`[DIRECT-ANALYSIS] No video URL available for video ${videoId}`);
      return NextResponse.json(
        { error: 'No video URL available for this video' },
        { status: 400 }
      );
    }

    // Get the original video URL
    const originalVideoUrl = video.download_url || video.video_url;

    // Update the video status to indicate analysis is in progress
    const { error: updateError } = await supabase
      .from('tiktok_videos')
      .update({
        frame_analysis: 'Analysis in progress...',
        last_analyzed_at: new Date().toISOString()
      })
      .eq('id', videoId);

    if (updateError) {
      console.error(`[DIRECT-ANALYSIS] Error updating video ${videoId} status:`, updateError);
      return NextResponse.json(
        { error: 'Error updating video status' },
        { status: 500 }
      );
    }

    // Start the analysis process in the background without waiting for it to complete
    // This prevents Vercel's 10-second timeout from being triggered
    analyzeVideoInBackground(videoId, originalVideoUrl);

    // Return a response immediately
    return NextResponse.json({
      success: true,
      message: 'Video analysis started',
      video_id: videoId,
      status: 'processing'
    });

  } catch (error: any) {
    console.error('[DIRECT-ANALYSIS] Unexpected error:', error);

    return NextResponse.json(
      { error: 'An unexpected error occurred', details: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Analyze a video in the background and update the database when complete
 * This implementation follows the exact approach from the video analyzer project
 */
async function analyzeVideoInBackground(videoId: string, originalVideoUrl: string) {
  let fileKey = '';

  try {
    console.log(`[DIRECT-ANALYSIS] Starting background analysis for video ${videoId}`);
    console.log(`[DIRECT-ANALYSIS] Using original video URL: ${originalVideoUrl}`);

    // Get the DashScope API key
    const dashscopeApiKey = process.env.DASHSCOPE_API_KEY;
    console.log(`[DIRECT-ANALYSIS] DashScope API key available: ${dashscopeApiKey ? 'Yes' : 'No'}`);
    console.log(`[DIRECT-ANALYSIS] DashScope API key length: ${dashscopeApiKey?.length || 0}`);

    if (!dashscopeApiKey) {
      console.error('[DIRECT-ANALYSIS] DashScope API key is missing');
      await updateVideoWithError(videoId, 'DashScope API key is missing');
      return;
    }

    // Log the first few characters of the API key for debugging (don't log the full key)
    if (dashscopeApiKey.length > 8) {
      console.log(`[DIRECT-ANALYSIS] DashScope API key prefix: ${dashscopeApiKey.substring(0, 4)}...${dashscopeApiKey.substring(dashscopeApiKey.length - 4)}`);
    }

    // Step 1: Ensure the bucket exists and is public
    try {
      console.log('[DIRECT-ANALYSIS] Checking if tiktok-videos bucket exists');
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();

      if (listError) {
        console.error('[DIRECT-ANALYSIS] Error listing buckets:', listError);
        await updateVideoWithError(videoId, `Error listing buckets: ${listError.message}`);
        return;
      }

      console.log(`[DIRECT-ANALYSIS] Buckets found: ${buckets?.map(b => b.name).join(', ') || 'none'}`);
      const bucket = buckets?.find(b => b.name === 'tiktok-videos');

      if (!bucket) {
        console.log('[DIRECT-ANALYSIS] Creating tiktok-videos bucket with public access');
        const { error: createError } = await supabase.storage.createBucket('tiktok-videos', {
          public: true,
          fileSizeLimit: 50 * 1024 * 1024 // 50MB limit
        });

        if (createError) {
          console.error('[DIRECT-ANALYSIS] Error creating bucket:', createError);
          await updateVideoWithError(videoId, `Error creating bucket: ${createError.message}`);
          return;
        }
        console.log('[DIRECT-ANALYSIS] Successfully created tiktok-videos bucket');
      } else {
        console.log('[DIRECT-ANALYSIS] Bucket found:', bucket);

        if (!bucket.public) {
          console.log('[DIRECT-ANALYSIS] Updating tiktok-videos bucket to be public');
          const { error: updateError } = await supabase.storage.updateBucket('tiktok-videos', {
            public: true,
            fileSizeLimit: 50 * 1024 * 1024 // 50MB limit
          });

          if (updateError) {
            console.error('[DIRECT-ANALYSIS] Error updating bucket to public:', updateError);
            await updateVideoWithError(videoId, `Error updating bucket: ${updateError.message}`);
            return;
          }
          console.log('[DIRECT-ANALYSIS] Successfully updated tiktok-videos bucket to public');
        } else {
          console.log('[DIRECT-ANALYSIS] tiktok-videos bucket already exists and is public');
        }
      }
    } catch (bucketError: any) {
      console.error('[DIRECT-ANALYSIS] Unexpected error managing bucket:', bucketError);
      await updateVideoWithError(videoId, `Unexpected error managing bucket: ${bucketError.message}`);
      return;
    }

    // Step 2: Download the video file
    let videoBuffer;
    try {
      console.log(`[DIRECT-ANALYSIS] Downloading video file from ${originalVideoUrl}`);
      const response = await axios.get(originalVideoUrl, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 60000 // 60 second timeout for download
      });

      videoBuffer = response.data;
      console.log(`[DIRECT-ANALYSIS] Video file downloaded, size: ${videoBuffer.byteLength} bytes`);

      if (!videoBuffer || videoBuffer.byteLength === 0) {
        console.error('[DIRECT-ANALYSIS] Downloaded video file is empty');
        await updateVideoWithError(videoId, 'Downloaded video file is empty');
        return;
      }

      if (videoBuffer.byteLength > 10 * 1024 * 1024) {
        console.warn(`[DIRECT-ANALYSIS] Warning: Video file is large (${(videoBuffer.byteLength / (1024 * 1024)).toFixed(2)} MB), which might exceed DashScope limits`);
      }
    } catch (downloadError: any) {
      console.error(`[DIRECT-ANALYSIS] Error downloading video file: ${downloadError.message}`);
      await updateVideoWithError(videoId, `Error downloading video file: ${downloadError.message}`);
      return;
    }

    // Step 3: Upload the video to Supabase storage
    let supabaseVideoUrl = '';
    try {
      fileKey = `tiktok-videos/${videoId}-${Date.now()}.mp4`;
      console.log(`[DIRECT-ANALYSIS] Uploading video to Supabase storage: ${fileKey}`);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('tiktok-videos')
        .upload(fileKey, videoBuffer, {
          contentType: 'video/mp4',
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error(`[DIRECT-ANALYSIS] Error uploading video to Supabase storage:`, uploadError);
        await updateVideoWithError(videoId, `Error uploading video: ${uploadError.message}`);
        return;
      }

      console.log(`[DIRECT-ANALYSIS] Video uploaded successfully to Supabase storage: ${fileKey}`);
      console.log('[DIRECT-ANALYSIS] Upload data:', uploadData);

      // Get the public URL of the video
      const { data: publicUrlData, error: urlError } = supabase.storage
        .from('tiktok-videos')
        .getPublicUrl(fileKey);

      if (urlError) {
        console.error('[DIRECT-ANALYSIS] Error getting public URL:', urlError);
        await updateVideoWithError(videoId, `Error getting public URL: ${urlError.message}`);
        return;
      }

      if (!publicUrlData || !publicUrlData.publicUrl) {
        console.error('[DIRECT-ANALYSIS] No public URL returned from Supabase');
        await updateVideoWithError(videoId, 'No public URL returned from Supabase');
        return;
      }

      supabaseVideoUrl = publicUrlData.publicUrl;
      console.log(`[DIRECT-ANALYSIS] Public URL for video: ${supabaseVideoUrl}`);

      // Verify the public URL is accessible
      try {
        console.log('[DIRECT-ANALYSIS] Verifying public URL is accessible');
        const checkResponse = await axios.head(supabaseVideoUrl, {
          timeout: 10000
        });
        console.log(`[DIRECT-ANALYSIS] Public URL is accessible, status: ${checkResponse.status}`);
      } catch (checkError: any) {
        console.warn(`[DIRECT-ANALYSIS] Warning: Could not verify public URL: ${checkError.message}`);
        console.warn('[DIRECT-ANALYSIS] Will attempt to continue anyway');
      }
    } catch (storageError: any) {
      console.error('[DIRECT-ANALYSIS] Error with Supabase storage:', storageError);
      await updateVideoWithError(videoId, `Error with Supabase storage: ${storageError.message}`);
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

    // Prepare the request payload for DashScope API using the exact format from the video analyzer project
    // Use the Supabase video URL instead of the original URL
    const requestBody = {
      model: 'qwen-vl-max',
      input: {
        messages: [
          {
            role: "system",
            content: [{ text: "You are a helpful assistant that analyzes TikTok videos in detail." }]
          },
          {
            role: "user",
            content: [
              { video: supabaseVideoUrl, fps: 2 }, // Use fps: 2 to extract frames at 2 frames per second
              { text: prompt }
            ]
          }
        ]
      }
    };

    // Prepare the headers
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${dashscopeApiKey.trim()}`
    };

    console.log('[DIRECT-ANALYSIS] Making API call to DashScope with video URL:', supabaseVideoUrl);

    try {
      console.log('[DIRECT-ANALYSIS] Preparing to make API call to DashScope');
      console.log('[DIRECT-ANALYSIS] Request URL: https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation');
      console.log('[DIRECT-ANALYSIS] Request headers:', JSON.stringify({
        'Content-Type': headers['Content-Type'],
        'Authorization': 'Bearer [REDACTED]'
      }, null, 2));
      console.log('[DIRECT-ANALYSIS] Request body structure:', JSON.stringify({
        model: requestBody.model,
        input: {
          messages: [
            {
              role: "system",
              content: [{ text: "..." }]
            },
            {
              role: "user",
              content: [
                { video: "...[video URL redacted]...", fps: requestBody.input.messages[1].content[0].fps },
                { text: "...[prompt redacted]..." }
              ]
            }
          ]
        }
      }, null, 2));

      // Make the API call to DashScope - using the exact endpoint from the video analyzer project
      const response = await axios.post(
        'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
        requestBody,
        {
          headers,
          timeout: 180000 // 3 minutes timeout for video processing
        }
      );

      console.log('[DIRECT-ANALYSIS] Received response from DashScope API');
      console.log('[DIRECT-ANALYSIS] Response status:', response.status);
      console.log('[DIRECT-ANALYSIS] Response headers:', JSON.stringify(response.headers, null, 2));
      console.log('[DIRECT-ANALYSIS] Response data structure:', JSON.stringify({
        output: response.data?.output ? { text: response.data.output.text ? 'Text present' : 'Text missing' } : 'Output missing',
        request_id: response.data?.request_id || 'Missing',
        usage: response.data?.usage || 'Missing'
      }, null, 2));

      // Extract the analysis from the response using the format from the video analyzer project
      const analysis = response.data?.output?.text || '';

      if (!analysis || analysis.length < 10) {
        console.error('[DIRECT-ANALYSIS] Empty or too short analysis received');
        console.error('[DIRECT-ANALYSIS] Full response data:', JSON.stringify(response.data, null, 2));
        await updateVideoWithError(videoId, 'The AI model returned an empty or too short analysis');
        return;
      }

      console.log('[DIRECT-ANALYSIS] Analysis received, length:', analysis.length);
      console.log('[DIRECT-ANALYSIS] Analysis preview:', analysis.substring(0, 100) + '...');

      // Update the video with the analysis
      const updateData = {
        frame_analysis: analysis,
        summary: analysis.substring(0, 500) + (analysis.length > 500 ? '...' : ''),
        last_analyzed_at: new Date().toISOString()
      };

      console.log(`[DIRECT-ANALYSIS] Updating video ${videoId} in database with analysis...`);
      const { error: updateError } = await supabase
        .from('tiktok_videos')
        .update(updateData)
        .eq('id', videoId);

      if (updateError) {
        console.error('[DIRECT-ANALYSIS] Error updating video with analysis:', updateError);
        await updateVideoWithError(videoId, `Error updating video: ${updateError.message}`);
        return;
      }

      console.log(`[DIRECT-ANALYSIS] Successfully updated video ${videoId} with analysis`);

    } catch (error: any) {
      console.error('[DIRECT-ANALYSIS] Error analyzing video with DashScope:', error);
      console.error('[DIRECT-ANALYSIS] Error stack:', error.stack);

      let errorMessage = error.message || 'Unknown error';

      if (error.response) {
        console.error('[DIRECT-ANALYSIS] Response status:', error.response.status);
        console.error('[DIRECT-ANALYSIS] Response headers:', JSON.stringify(error.response.headers, null, 2));

        try {
          console.error('[DIRECT-ANALYSIS] Response data:', JSON.stringify(error.response.data, null, 2));
          if (error.response.data && error.response.data.error) {
            errorMessage = `API Error: ${error.response.data.error.message || error.response.data.error}`;
          }
        } catch (jsonError) {
          console.error('[DIRECT-ANALYSIS] Error stringifying response data:', jsonError);
          console.error('[DIRECT-ANALYSIS] Raw response data:', error.response.data);
        }
      } else if (error.request) {
        console.error('[DIRECT-ANALYSIS] No response received from server');
        errorMessage = 'No response received from DashScope API (timeout or network issue)';
      } else {
        console.error('[DIRECT-ANALYSIS] Error setting up request:', error.message);
      }

      await updateVideoWithError(videoId, `Error analyzing video: ${errorMessage}`);
    }
  } catch (error: any) {
    console.error('[DIRECT-ANALYSIS] Unexpected error in background analysis:', error);
    console.error('[DIRECT-ANALYSIS] Error stack:', error.stack);

    // Get more detailed error information
    let errorDetails = 'Unknown error';
    if (error.message) {
      errorDetails = error.message;
    }
    if (error.response) {
      errorDetails += ' | Response status: ' + error.response.status;
      if (error.response.data) {
        try {
          errorDetails += ' | Response data: ' + JSON.stringify(error.response.data);
        } catch (e) {
          errorDetails += ' | Response data available but not stringifiable';
        }
      }
    }

    await updateVideoWithError(videoId, `Analysis error: ${errorDetails}`);
  } finally {
    // Clean up the temporary file
    if (fileKey) {
      try {
        console.log(`[DIRECT-ANALYSIS] Deleting temporary file from Supabase storage: ${fileKey}`);
        const { error: deleteError } = await supabase.storage
          .from('tiktok-videos')
          .remove([fileKey]);

        if (deleteError) {
          console.error(`[DIRECT-ANALYSIS] Error deleting temporary file: ${deleteError.message}`);
        } else {
          console.log(`[DIRECT-ANALYSIS] Successfully deleted temporary file: ${fileKey}`);
        }
      } catch (deleteError: any) {
        console.error(`[DIRECT-ANALYSIS] Error deleting temporary file: ${deleteError.message}`);
      }
    }
  }
}

/**
 * Update a video with an error message
 */
async function updateVideoWithError(videoId: string, errorMessage: string) {
  try {
    console.log(`[DIRECT-ANALYSIS] Updating video ${videoId} with error message: ${errorMessage}`);

    const { error } = await supabase
      .from('tiktok_videos')
      .update({
        frame_analysis: `Analysis failed: ${errorMessage}`,
        last_analyzed_at: new Date().toISOString()
      })
      .eq('id', videoId);

    if (error) {
      console.error(`[DIRECT-ANALYSIS] Error updating video with error message:`, error);
    } else {
      console.log(`[DIRECT-ANALYSIS] Successfully updated video ${videoId} with error message`);
    }
  } catch (error: any) {
    console.error(`[DIRECT-ANALYSIS] Error updating video with error message:`, error);
  }
}
