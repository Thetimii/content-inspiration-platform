import { NextResponse } from 'next/server';
import axios from 'axios';
import { supabase } from '@/utils/supabase';

/**
 * API endpoint to analyze a TikTok video using Alibaba Cloud DashScope API
 * This is a clean implementation that properly downloads the video, saves it to Supabase,
 * and uses the correct URL for the DashScope API
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

    console.log(`[TIKTOK-ANALYSIS] Starting analysis for video ${videoId} and user ${userId}`);

    // Get the video from the database
    const { data: video, error: videoError } = await supabase
      .from('tiktok_videos')
      .select('*')
      .eq('id', videoId)
      .single();

    if (videoError || !video) {
      console.error(`[TIKTOK-ANALYSIS] Error fetching video ${videoId}:`, videoError);
      return NextResponse.json(
        { error: 'Error fetching video or video not found' },
        { status: 404 }
      );
    }

    // Check if the video already has analysis
    if (video.frame_analysis && video.frame_analysis !== 'Analysis in progress...') {
      console.log(`[TIKTOK-ANALYSIS] Video ${videoId} already has analysis, returning existing analysis`);
      return NextResponse.json({
        success: true,
        message: 'Video already has analysis',
        video,
        analysis: video.frame_analysis
      });
    }

    // Check if analysis is already in progress and when it started
    if (video.frame_analysis === 'Analysis in progress...' && video.last_analyzed_at) {
      const lastAnalyzedAt = new Date(video.last_analyzed_at);
      const now = new Date();
      const timeDiffMinutes = (now.getTime() - lastAnalyzedAt.getTime()) / (1000 * 60);

      console.log(`[TIKTOK-ANALYSIS] Analysis already in progress for video ${videoId} since ${timeDiffMinutes.toFixed(2)} minutes ago`);

      // If analysis has been running for more than 5 minutes, assume it's stuck and restart
      if (timeDiffMinutes > 5) {
        console.log(`[TIKTOK-ANALYSIS] Previous analysis appears to be stuck (${timeDiffMinutes.toFixed(2)} minutes). Restarting analysis.`);
      } else {
        // Otherwise, return that analysis is already in progress
        return NextResponse.json({
          success: true,
          message: 'Analysis already in progress',
          video_id: videoId,
          status: 'processing'
        });
      }
    }

    // Make sure we have a video URL
    if (!video.video_url && !video.download_url) {
      console.error(`[TIKTOK-ANALYSIS] No video URL available for video ${videoId}`);
      return NextResponse.json(
        { error: 'No video URL available for this video' },
        { status: 400 }
      );
    }

    // Update the video status to indicate analysis is in progress
    const { error: updateError } = await supabase
      .from('tiktok_videos')
      .update({
        frame_analysis: 'Analysis in progress...',
        last_analyzed_at: new Date().toISOString()
      })
      .eq('id', videoId);

    if (updateError) {
      console.error(`[TIKTOK-ANALYSIS] Error updating video ${videoId} status:`, updateError);
      return NextResponse.json(
        { error: 'Error updating video status' },
        { status: 500 }
      );
    }

    // Start the analysis process in the background without waiting for it to complete
    // This prevents Vercel's 10-second timeout from being triggered
    analyzeVideoInBackground(videoId, video.download_url || video.video_url);

    // Return a response immediately
    return NextResponse.json({
      success: true,
      message: 'Video analysis started',
      video_id: videoId,
      status: 'processing'
    });

  } catch (error: any) {
    console.error('[TIKTOK-ANALYSIS] Unexpected error:', error);

    return NextResponse.json(
      { error: 'An unexpected error occurred', details: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Analyze a video in the background and update the database when complete
 */
async function analyzeVideoInBackground(videoId: string, videoUrl: string) {
  let fileKey = '';

  try {
    console.log(`[TIKTOK-ANALYSIS] Starting background analysis for video ${videoId}`);
    console.log(`[TIKTOK-ANALYSIS] Original video URL: ${videoUrl}`);

    // Get the DashScope API key
    const dashscopeApiKey = process.env.DASHSCOPE_API_KEY;
    console.log(`[TIKTOK-ANALYSIS] DashScope API key available: ${dashscopeApiKey ? 'Yes' : 'No'}`);
    console.log(`[TIKTOK-ANALYSIS] DashScope API key length: ${dashscopeApiKey?.length || 0}`);

    if (!dashscopeApiKey) {
      console.error('[TIKTOK-ANALYSIS] DashScope API key is missing');
      await updateVideoWithError(videoId, 'DashScope API key is missing');
      return;
    }

    // Log the first few characters of the API key for debugging (don't log the full key)
    if (dashscopeApiKey.length > 8) {
      console.log(`[TIKTOK-ANALYSIS] DashScope API key prefix: ${dashscopeApiKey.substring(0, 4)}...${dashscopeApiKey.substring(dashscopeApiKey.length - 4)}`);
    }

    // Step 1: Ensure the bucket exists and is public
    try {
      console.log('[TIKTOK-ANALYSIS] Checking if tiktok-videos bucket exists');
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();

      if (listError) {
        console.error('[TIKTOK-ANALYSIS] Error listing buckets:', listError);
        await updateVideoWithError(videoId, `Error listing buckets: ${listError.message}`);
        return;
      }

      console.log(`[TIKTOK-ANALYSIS] Buckets found: ${buckets?.map(b => b.name).join(', ') || 'none'}`);
      const bucket = buckets?.find(b => b.name === 'tiktok-videos');

      if (!bucket) {
        console.log('[TIKTOK-ANALYSIS] Creating tiktok-videos bucket with public access');
        const { error: createError } = await supabase.storage.createBucket('tiktok-videos', {
          public: true,
          fileSizeLimit: 50 * 1024 * 1024 // 50MB limit
        });

        if (createError) {
          console.error('[TIKTOK-ANALYSIS] Error creating bucket:', createError);
          await updateVideoWithError(videoId, `Error creating bucket: ${createError.message}`);
          return;
        }
        console.log('[TIKTOK-ANALYSIS] Successfully created tiktok-videos bucket');
      } else {
        console.log('[TIKTOK-ANALYSIS] Bucket found:', bucket);

        if (!bucket.public) {
          console.log('[TIKTOK-ANALYSIS] Updating tiktok-videos bucket to be public');
          const { error: updateError } = await supabase.storage.updateBucket('tiktok-videos', {
            public: true,
            fileSizeLimit: 50 * 1024 * 1024 // 50MB limit
          });

          if (updateError) {
            console.error('[TIKTOK-ANALYSIS] Error updating bucket to public:', updateError);
            await updateVideoWithError(videoId, `Error updating bucket: ${updateError.message}`);
            return;
          }
          console.log('[TIKTOK-ANALYSIS] Successfully updated tiktok-videos bucket to public');
        } else {
          console.log('[TIKTOK-ANALYSIS] tiktok-videos bucket already exists and is public');
        }
      }
    } catch (bucketError: any) {
      console.error('[TIKTOK-ANALYSIS] Unexpected error managing bucket:', bucketError);
      await updateVideoWithError(videoId, `Unexpected error managing bucket: ${bucketError.message}`);
      return;
    }

    // Step 2: Download the video file
    let videoBuffer;
    try {
      console.log(`[TIKTOK-ANALYSIS] Downloading video file from ${videoUrl}`);
      const response = await axios.get(videoUrl, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 60000 // 60 second timeout for download
      });

      videoBuffer = response.data;
      console.log(`[TIKTOK-ANALYSIS] Video file downloaded, size: ${videoBuffer.byteLength} bytes`);

      if (!videoBuffer || videoBuffer.byteLength === 0) {
        console.error('[TIKTOK-ANALYSIS] Downloaded video file is empty');
        await updateVideoWithError(videoId, 'Downloaded video file is empty');
        return;
      }

      if (videoBuffer.byteLength > 10 * 1024 * 1024) {
        console.warn(`[TIKTOK-ANALYSIS] Warning: Video file is large (${(videoBuffer.byteLength / (1024 * 1024)).toFixed(2)} MB), which might exceed DashScope limits`);
      }
    } catch (downloadError: any) {
      console.error(`[TIKTOK-ANALYSIS] Error downloading video file: ${downloadError.message}`);
      await updateVideoWithError(videoId, `Error downloading video file: ${downloadError.message}`);
      return;
    }

    // Step 3: Upload the video to Supabase storage
    try {
      fileKey = `tiktok-videos/${videoId}-${Date.now()}.mp4`;
      console.log(`[TIKTOK-ANALYSIS] Uploading video to Supabase storage: ${fileKey}`);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('tiktok-videos')
        .upload(fileKey, videoBuffer, {
          contentType: 'video/mp4',
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error(`[TIKTOK-ANALYSIS] Error uploading video to Supabase storage:`, uploadError);
        await updateVideoWithError(videoId, `Error uploading video: ${uploadError.message}`);
        return;
      }

      console.log(`[TIKTOK-ANALYSIS] Video uploaded successfully to Supabase storage: ${fileKey}`);
      console.log('[TIKTOK-ANALYSIS] Upload data:', uploadData);
    } catch (uploadError: any) {
      console.error(`[TIKTOK-ANALYSIS] Unexpected error uploading file:`, uploadError);
      await updateVideoWithError(videoId, `Unexpected error uploading file: ${uploadError.message}`);
      return;
    }

    // Step 4: Get the public URL of the video
    let publicVideoUrl = '';
    try {
      console.log(`[TIKTOK-ANALYSIS] Getting public URL for file: ${fileKey}`);
      const { data: publicUrlData, error: urlError } = supabase.storage
        .from('tiktok-videos')
        .getPublicUrl(fileKey);

      if (urlError) {
        console.error('[TIKTOK-ANALYSIS] Error getting public URL:', urlError);
        await updateVideoWithError(videoId, `Error getting public URL: ${urlError.message}`);
        return;
      }

      if (!publicUrlData || !publicUrlData.publicUrl) {
        console.error('[TIKTOK-ANALYSIS] No public URL returned from Supabase');
        await updateVideoWithError(videoId, 'No public URL returned from Supabase');
        return;
      }

      publicVideoUrl = publicUrlData.publicUrl;
      console.log(`[TIKTOK-ANALYSIS] Public URL for video: ${publicVideoUrl}`);

      // Step 5: Verify the public URL is accessible
      try {
        console.log('[TIKTOK-ANALYSIS] Verifying public URL is accessible');
        const checkResponse = await axios.head(publicVideoUrl, {
          timeout: 10000
        });
        console.log(`[TIKTOK-ANALYSIS] Public URL is accessible, status: ${checkResponse.status}`);
      } catch (checkError: any) {
        console.warn(`[TIKTOK-ANALYSIS] Warning: Could not verify public URL: ${checkError.message}`);
        console.warn('[TIKTOK-ANALYSIS] Will attempt to continue anyway');
      }
    } catch (urlError: any) {
      console.error('[TIKTOK-ANALYSIS] Error getting or verifying public URL:', urlError);
      await updateVideoWithError(videoId, `Error with public URL: ${urlError.message}`);
      return;
    }

    // Step 6: Call DashScope API to analyze the video
    try {
      console.log(`[TIKTOK-ANALYSIS] Calling DashScope API for video ${videoId}`);

      // Prepare the prompt for video analysis
      const prompt = `Analyze this TikTok video in detail. Please provide:
1. A comprehensive summary of what's happening in the video
2. Key visual elements and objects present
3. Any text or captions visible in the video
4. The overall theme or message of the content
5. What makes this content engaging or trending

Be specific and detailed in your analysis.`;

      // Prepare the request payload for DashScope API
      const requestPayload = {
        model: "qwen-vl-max", // Using the best Qwen model for video analysis
        messages: [
          {
            role: "system",
            content: [
              {
                type: "text",
                text: "You are a helpful assistant that analyzes TikTok videos in detail. If you can only see a frame or part of the video, analyze what you can see and mention that you're analyzing based on limited content."
              }
            ]
          },
          {
            role: "user",
            content: [
              {
                type: "video_url",
                video_url: {
                  url: publicVideoUrl
                }
              },
              {
                type: "text",
                text: prompt
              }
            ]
          }
        ],
        max_tokens: 2048, // Maximum allowed by DashScope API
        temperature: 0.7
      };

      // Prepare the headers
      const headers = {
        'Authorization': `Bearer ${dashscopeApiKey.trim()}`,
        'Content-Type': 'application/json'
      };

      console.log('[TIKTOK-ANALYSIS] Making DashScope API call with model: qwen-vl-max to https://dashscope-intl.aliyuncs.com');
      console.log('[TIKTOK-ANALYSIS] Request payload:', JSON.stringify(requestPayload, null, 2));
      console.log('[TIKTOK-ANALYSIS] Headers:', JSON.stringify({
        'Authorization': 'Bearer [REDACTED]',
        'Content-Type': headers['Content-Type']
      }, null, 2));

      let analysis = '';
      try {
        console.log('[TIKTOK-ANALYSIS] Sending request to DashScope API...');

        // Set a shorter timeout for debugging
        const timeout = 30000; // 30 seconds
        console.log(`[TIKTOK-ANALYSIS] Setting timeout to ${timeout}ms`);

        // Create a timeout promise
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error(`DashScope API request timed out after ${timeout}ms`));
          }, timeout);
        });

        // Create the API request promise
        const apiRequestPromise = axios.post(
          'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
          requestPayload,
          {
            headers,
            // Don't set axios timeout, we'll handle it ourselves
          }
        );

        // Race the promises
        console.log('[TIKTOK-ANALYSIS] Starting race between API request and timeout');
        const dashscopeResponse = await Promise.race([
          apiRequestPromise,
          timeoutPromise
        ]) as any;

        console.log('[TIKTOK-ANALYSIS] DashScope API response received');
        console.log('[TIKTOK-ANALYSIS] Response status:', dashscopeResponse.status);
        console.log('[TIKTOK-ANALYSIS] Response headers:', JSON.stringify(dashscopeResponse.headers, null, 2));
        console.log('[TIKTOK-ANALYSIS] Response data:', JSON.stringify(dashscopeResponse.data, null, 2));

        // Extract the analysis from the response
        analysis = dashscopeResponse.data?.choices?.[0]?.message?.content || '';
        console.log('[TIKTOK-ANALYSIS] Extracted analysis:', analysis ? (analysis.length > 100 ? analysis.substring(0, 100) + '...' : analysis) : 'null');
      } catch (apiError: any) {
        console.error('[TIKTOK-ANALYSIS] Error calling DashScope API:', apiError.message);
        console.error('[TIKTOK-ANALYSIS] Error details:', {
          status: apiError.response?.status,
          statusText: apiError.response?.statusText,
          data: apiError.response?.data,
          headers: apiError.response?.headers
        });

        // Check if the error is due to video length
        const errorMessage = apiError.response?.data?.error?.message || '';
        if (errorMessage.includes('video file is too long') || errorMessage.includes('too long')) {
          console.log('[TIKTOK-ANALYSIS] Video is too long for DashScope API. Trying with a different approach...');

          // Try with a different model that might handle longer videos
          try {
            console.log('[TIKTOK-ANALYSIS] Trying with a different model configuration...');

            // Use a different model or configuration
            const fallbackPayload = {
              model: "qwen-vl-plus", // Try with a smaller model that might have different limitations
              messages: [
                {
                  role: "system",
                  content: [
                    {
                      type: "text",
                      text: "You are a helpful assistant that analyzes TikTok videos in detail. If you can only see a frame or part of the video, analyze what you can see and mention that you're analyzing based on limited content."
                    }
                  ]
                },
                {
                  role: "user",
                  content: [
                    {
                      type: "video_url",
                      video_url: {
                        url: publicVideoUrl
                      }
                    },
                    {
                      type: "text",
                      text: "This video might be too long for complete analysis. Please analyze what you can see in the video and provide insights based on the visible content."
                    }
                  ]
                }
              ],
              max_tokens: 2048, // Maximum allowed by DashScope API
              temperature: 0.7
            };

            console.log('[TIKTOK-ANALYSIS] Making fallback DashScope API call with model: qwen-vl-plus');
            console.log('[TIKTOK-ANALYSIS] Fallback payload:', JSON.stringify(fallbackPayload, null, 2));

            const fallbackResponse = await axios.post(
              'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
              fallbackPayload,
              {
                headers,
                timeout: 120000 // 2 minute timeout
              }
            );

            console.log('[TIKTOK-ANALYSIS] Fallback DashScope API response received');
            console.log('[TIKTOK-ANALYSIS] Fallback response status:', fallbackResponse.status);
            console.log('[TIKTOK-ANALYSIS] Fallback response data:', JSON.stringify(fallbackResponse.data, null, 2));

            // Extract the analysis from the fallback response
            const fallbackAnalysis = fallbackResponse.data?.choices?.[0]?.message?.content || '';

            if (fallbackAnalysis && fallbackAnalysis.length > 10) {
              console.log('[TIKTOK-ANALYSIS] Fallback analysis received, length:', fallbackAnalysis.length);
              analysis = fallbackAnalysis;
            } else {
              console.log('[TIKTOK-ANALYSIS] Fallback analysis was empty or too short');
              throw new Error('Both primary and fallback analysis attempts failed');
            }
          } catch (fallbackError: any) {
            console.error('[TIKTOK-ANALYSIS] Error with fallback analysis:', fallbackError.message);
            console.error('[TIKTOK-ANALYSIS] Fallback error details:', {
              status: fallbackError.response?.status,
              data: fallbackError.response?.data
            });
            throw fallbackError;
          }
        } else {
          // If it's not a video length issue, re-throw the original error
          throw apiError;
        }
      }

      if (!analysis || analysis.length < 10) {
        console.error('[TIKTOK-ANALYSIS] Empty or too short analysis received');

        // Try a simpler approach - just extract a frame and describe it
        try {
          console.log('[TIKTOK-ANALYSIS] Trying a simpler approach - using a basic prompt');

          // Use a simpler prompt
          const simplePrompt = {
            model: "qwen-vl-plus", // Use a smaller model
            messages: [
              {
                role: "system",
                content: [
                  {
                    type: "text",
                    text: "You are a helpful assistant that describes TikTok videos."
                  }
                ]
              },
              {
                role: "user",
                content: [
                  {
                    type: "video_url",
                    video_url: {
                      url: publicVideoUrl
                    }
                  },
                  {
                    type: "text",
                    text: "Please describe what you see in this video in a few sentences."
                  }
                ]
              }
            ],
            max_tokens: 1024,
            temperature: 0.7
          };

          console.log('[TIKTOK-ANALYSIS] Making simple DashScope API call');

          // Set a shorter timeout for the simple approach
          const simpleTimeout = 20000; // 20 seconds

          // Create a timeout promise
          const simpleTimeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
              reject(new Error(`Simple DashScope API request timed out after ${simpleTimeout}ms`));
            }, simpleTimeout);
          });

          // Create the API request promise
          const simpleApiRequestPromise = axios.post(
            'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
            simplePrompt,
            { headers }
          );

          // Race the promises
          const simpleResponse = await Promise.race([
            simpleApiRequestPromise,
            simpleTimeoutPromise
          ]) as any;

          const simpleAnalysis = simpleResponse.data?.choices?.[0]?.message?.content || '';

          if (simpleAnalysis && simpleAnalysis.length > 10) {
            console.log('[TIKTOK-ANALYSIS] Simple analysis received:', simpleAnalysis.substring(0, 100) + '...');
            analysis = `Simple analysis (limited due to video processing constraints):\n\n${simpleAnalysis}`;
          } else {
            throw new Error('Simple analysis also failed');
          }
        } catch (simpleError: any) {
          console.error('[TIKTOK-ANALYSIS] Simple approach also failed:', simpleError.message);
          await updateVideoWithError(videoId, 'Multiple analysis attempts failed. The video may be too complex or too long.');
          return;
        }
      }

      console.log(`[TIKTOK-ANALYSIS] Analysis received for video ${videoId}, length: ${analysis.length} characters`);

      // Step 7: Update the video with the analysis
      const updateData = {
        frame_analysis: analysis,
        summary: analysis.substring(0, 500) + (analysis.length > 500 ? '...' : ''),
        last_analyzed_at: new Date().toISOString()
      };

      console.log(`[TIKTOK-ANALYSIS] Updating video ${videoId} in database with analysis...`);
      const { error: updateError } = await supabase
        .from('tiktok_videos')
        .update(updateData)
        .eq('id', videoId);

      if (updateError) {
        console.error('[TIKTOK-ANALYSIS] Error updating video with analysis:', updateError);
        await updateVideoWithError(videoId, `Error updating video: ${updateError.message}`);
        return;
      }

      console.log(`[TIKTOK-ANALYSIS] Successfully updated video ${videoId} with analysis`);

      // Verify the update by fetching the video again
      const { data: updatedVideo, error: fetchError } = await supabase
        .from('tiktok_videos')
        .select('id, frame_analysis, last_analyzed_at')
        .eq('id', videoId)
        .single();

      if (fetchError) {
        console.error('[TIKTOK-ANALYSIS] Error verifying update:', fetchError);
      } else {
        console.log('[TIKTOK-ANALYSIS] Verified update:', {
          id: updatedVideo.id,
          frame_analysis_length: updatedVideo.frame_analysis ? updatedVideo.frame_analysis.length : 0,
          last_analyzed_at: updatedVideo.last_analyzed_at
        });
      }
    } catch (analysisError: any) {
      console.error('[TIKTOK-ANALYSIS] Error analyzing video with DashScope:', analysisError);
      console.error('[TIKTOK-ANALYSIS] Error details:', {
        message: analysisError.message || 'Unknown error',
        status: analysisError.response?.status,
        data: analysisError.response?.data
      });

      await updateVideoWithError(videoId, `Error analyzing video: ${analysisError.message || 'Unknown error'}`);
    }
  } catch (error: any) {
    console.error('[TIKTOK-ANALYSIS] Unexpected error in background analysis:', error);
    await updateVideoWithError(videoId, 'An unexpected error occurred during analysis');
  } finally {
    // Clean up the temporary file
    if (fileKey) {
      try {
        console.log(`[TIKTOK-ANALYSIS] Deleting temporary file from Supabase storage: ${fileKey}`);
        const { error: deleteError } = await supabase.storage
          .from('tiktok-videos')
          .remove([fileKey]);

        if (deleteError) {
          console.error(`[TIKTOK-ANALYSIS] Error deleting temporary file: ${deleteError.message}`);
        } else {
          console.log(`[TIKTOK-ANALYSIS] Successfully deleted temporary file: ${fileKey}`);
        }
      } catch (deleteError: any) {
        console.error(`[TIKTOK-ANALYSIS] Error deleting temporary file: ${deleteError.message}`);
      }
    }
  }
}

/**
 * Update a video with an error message
 */
async function updateVideoWithError(videoId: string, errorMessage: string) {
  try {
    console.log(`[TIKTOK-ANALYSIS] Updating video ${videoId} with error message: ${errorMessage}`);

    const { error } = await supabase
      .from('tiktok_videos')
      .update({
        frame_analysis: `Analysis failed: ${errorMessage}`,
        last_analyzed_at: new Date().toISOString()
      })
      .eq('id', videoId);

    if (error) {
      console.error(`[TIKTOK-ANALYSIS] Error updating video with error message:`, error);
    } else {
      console.log(`[TIKTOK-ANALYSIS] Successfully updated video ${videoId} with error message`);
    }
  } catch (error: any) {
    console.error(`[TIKTOK-ANALYSIS] Error updating video with error message:`, error);
  }
}
