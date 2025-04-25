import { NextResponse } from 'next/server';
import axios from 'axios';
import { supabase } from '@/utils/supabase';

/**
 * API endpoint to analyze a video using Alibaba Cloud DashScope API
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

    console.log(`Starting video analysis for video ${videoId} and user ${userId}`);

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
    if (video.frame_analysis && video.frame_analysis !== 'Analysis in progress...') {
      console.log(`Video ${videoId} already has analysis, returning existing analysis`);
      return NextResponse.json({
        success: true,
        message: 'Video already has analysis',
        video,
        analysis: video.frame_analysis
      });
    }

    // Make sure we have a video URL
    if (!video.video_url && !video.download_url) {
      return NextResponse.json(
        { error: 'No video URL available for this video' },
        { status: 400 }
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
    analyzeVideoInBackground(videoId, video.download_url || video.video_url);

    // Return a response immediately
    return NextResponse.json({
      success: true,
      message: 'Video analysis started',
      video_id: videoId,
      status: 'processing'
    });

  } catch (error: any) {
    console.error('Unexpected error in video-analysis route:', error);

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
    console.log(`Starting background analysis for video ${videoId}`);
    console.log(`Using video URL: ${videoUrl}`);

    // Get the DashScope API key
    const dashscopeApiKey = process.env.DASHSCOPE_API_KEY;
    console.log('DashScope API key available:', dashscopeApiKey ? 'Yes' : 'No');
    console.log('DashScope API key length:', dashscopeApiKey?.length || 0);

    if (!dashscopeApiKey) {
      console.error('DashScope API key is missing');
      await updateVideoWithError(videoId, 'DashScope API key is missing');
      return;
    }

    // Log the first few characters of the API key for debugging (don't log the full key)
    if (dashscopeApiKey.length > 8) {
      console.log('DashScope API key prefix:', dashscopeApiKey.substring(0, 4) + '...' + dashscopeApiKey.substring(dashscopeApiKey.length - 4));
    }

    // Step 1: Ensure the bucket exists and is public
    try {
      console.log('Checking if tiktok-videos bucket exists');
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();

      if (listError) {
        console.error('Error listing buckets:', listError);
        await updateVideoWithError(videoId, `Error listing buckets: ${listError.message}`);
        return;
      }

      const bucket = buckets?.find(b => b.name === 'tiktok-videos');

      if (!bucket) {
        console.log('Creating tiktok-videos bucket with public access');
        const { error: createError } = await supabase.storage.createBucket('tiktok-videos', {
          public: true,
          fileSizeLimit: 50 * 1024 * 1024 // 50MB limit
        });

        if (createError) {
          console.error('Error creating bucket:', createError);
          await updateVideoWithError(videoId, `Error creating bucket: ${createError.message}`);
          return;
        }
      } else if (!bucket.public) {
        console.log('Updating tiktok-videos bucket to be public');
        const { error: updateError } = await supabase.storage.updateBucket('tiktok-videos', {
          public: true,
          fileSizeLimit: 50 * 1024 * 1024 // 50MB limit
        });

        if (updateError) {
          console.error('Error updating bucket to public:', updateError);
          await updateVideoWithError(videoId, `Error updating bucket: ${updateError.message}`);
          return;
        }
      }
    } catch (bucketError: any) {
      console.error('Unexpected error managing bucket:', bucketError);
      await updateVideoWithError(videoId, `Unexpected error managing bucket: ${bucketError.message}`);
      return;
    }

    // Step 2: Download the video file
    let videoBuffer;
    try {
      console.log(`Downloading video file from ${videoUrl}`);
      const response = await axios.get(videoUrl, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 60000 // 60 second timeout for download
      });

      videoBuffer = response.data;
      console.log(`Video file downloaded, size: ${videoBuffer.byteLength} bytes`);
    } catch (downloadError: any) {
      console.error(`Error downloading video file: ${downloadError.message}`);
      await updateVideoWithError(videoId, `Error downloading video file: ${downloadError.message}`);
      return;
    }

    if (!videoBuffer || videoBuffer.byteLength === 0) {
      console.error('Downloaded video file is empty');
      await updateVideoWithError(videoId, 'Downloaded video file is empty');
      return;
    }

    // Step 3: Extract a frame from the video as a fallback
    // Since the DashScope API has limitations on video length, we'll extract a frame as a fallback
    try {
      // First, try to upload the full video
      fileKey = `videos/${videoId}-${Date.now()}.mp4`;
      console.log(`Uploading video to Supabase storage: ${fileKey}`);

      const { error: uploadError } = await supabase.storage
        .from('tiktok-videos')
        .upload(fileKey, videoBuffer, {
          contentType: 'video/mp4',
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error(`Error uploading video to Supabase storage:`, uploadError);
        await updateVideoWithError(videoId, `Error uploading video: ${uploadError.message}`);
        return;
      }

      console.log('Video uploaded successfully. Will try to analyze the full video first.');
    } catch (uploadError: any) {
      console.error(`Unexpected error uploading file:`, uploadError);
      await updateVideoWithError(videoId, `Unexpected error uploading file: ${uploadError.message}`);
      return;
    }

    // Step 4: Get the public URL of the video
    let publicVideoUrl = '';
    try {
      console.log(`Getting public URL for file: ${fileKey}`);
      const { data: publicUrlData, error: urlError } = supabase.storage
        .from('tiktok-videos')
        .getPublicUrl(fileKey);

      if (urlError) {
        console.error('Error getting public URL:', urlError);
        await updateVideoWithError(videoId, `Error getting public URL: ${urlError.message}`);
        return;
      }

      if (!publicUrlData || !publicUrlData.publicUrl) {
        console.error('No public URL returned from Supabase');
        await updateVideoWithError(videoId, 'No public URL returned from Supabase');
        return;
      }

      publicVideoUrl = publicUrlData.publicUrl;
      console.log(`Public URL for video: ${publicVideoUrl}`);

      // Step 5: Verify the public URL is accessible
      try {
        console.log('Verifying public URL is accessible');
        const checkResponse = await axios.head(publicVideoUrl, {
          timeout: 10000
        });
        console.log(`Public URL is accessible, status: ${checkResponse.status}`);
      } catch (checkError: any) {
        console.warn(`Warning: Could not verify public URL: ${checkError.message}`);
        console.warn('Will attempt to continue anyway');
      }
    } catch (urlError: any) {
      console.error('Error getting or verifying public URL:', urlError);
      await updateVideoWithError(videoId, `Error with public URL: ${urlError.message}`);
      return;
    }

    // Step 6: Call DashScope API to analyze the video
    try {
      console.log(`Calling DashScope API for video ${videoId}`);

      // Prepare the prompt for video analysis
      const prompt = `Analyze this TikTok video in detail. Please provide:
1. A comprehensive summary of what's happening in the video
2. Key visual elements and objects present
3. Any text or captions visible in the video
4. The overall theme or message of the content
5. What makes this content engaging or trending

Be specific and detailed in your analysis.`;

      // Prepare the request payload for DashScope API
      // Note: DashScope has limitations on video length (typically 30-60 seconds max)
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
                text: prompt + "\n\nNote: If you can only see a frame or part of the video, please analyze what you can see and mention that you're analyzing based on limited content."
              }
            ]
          }
        ],
        // Add parameters to help with video processing
        max_tokens: 4000,
        temperature: 0.7
      };

      // Prepare the headers
      const headers = {
        'Authorization': `Bearer ${dashscopeApiKey.trim()}`,
        'Content-Type': 'application/json'
      };

      console.log('Making DashScope API call with model: qwen-vl-max to https://dashscope-intl.aliyuncs.com');
      console.log('Request payload:', JSON.stringify(requestPayload, null, 2));
      console.log('Headers:', JSON.stringify({
        'Authorization': 'Bearer [REDACTED]',
        'Content-Type': headers['Content-Type']
      }, null, 2));

      let analysis = '';
      try {
        console.log('Sending request to DashScope API...');
        const dashscopeResponse = await axios.post(
          'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
          requestPayload,
          {
            headers,
            timeout: 120000 // 2 minute timeout
          }
        );

        console.log('DashScope API response received');
        console.log('Response status:', dashscopeResponse.status);
        console.log('Response headers:', JSON.stringify(dashscopeResponse.headers, null, 2));
        console.log('Response data:', JSON.stringify(dashscopeResponse.data, null, 2));

        // Extract the analysis from the response
        analysis = dashscopeResponse.data?.choices?.[0]?.message?.content || '';
      } catch (apiError: any) {
        console.error('Error calling DashScope API:', apiError.message);
        console.error('Error details:', {
          status: apiError.response?.status,
          statusText: apiError.response?.statusText,
          data: apiError.response?.data,
          headers: apiError.response?.headers
        });

        // Check if the error is due to video length
        const errorMessage = apiError.response?.data?.error?.message || '';
        if (errorMessage.includes('video file is too long') || errorMessage.includes('too long')) {
          console.log('Video is too long for DashScope API. Trying with a different approach...');

          // Try with a different model that might handle longer videos
          try {
            console.log('Trying with a different model configuration...');

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
              max_tokens: 2000,
              temperature: 0.7
            };

            console.log('Making fallback DashScope API call with model: qwen-vl-plus');
            console.log('Fallback payload:', JSON.stringify(fallbackPayload, null, 2));

            const fallbackResponse = await axios.post(
              'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
              fallbackPayload,
              {
                headers,
                timeout: 120000 // 2 minute timeout
              }
            );

            console.log('Fallback DashScope API response received');
            console.log('Fallback response status:', fallbackResponse.status);
            console.log('Fallback response data:', JSON.stringify(fallbackResponse.data, null, 2));

            // Extract the analysis from the fallback response
            const fallbackAnalysis = fallbackResponse.data?.choices?.[0]?.message?.content || '';

            if (fallbackAnalysis && fallbackAnalysis.length > 10) {
              console.log('Fallback analysis received, length:', fallbackAnalysis.length);
              return fallbackAnalysis;
            } else {
              console.log('Fallback analysis was empty or too short');
              throw new Error('Both primary and fallback analysis attempts failed');
            }
          } catch (fallbackError: any) {
            console.error('Error with fallback analysis:', fallbackError.message);
            console.error('Fallback error details:', {
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

      // Log the extracted analysis
      console.log('Extracted analysis:', analysis ? (analysis.length > 100 ? analysis.substring(0, 100) + '...' : analysis) : 'null');

      if (!analysis || analysis.length < 10) {
        console.error('Empty or too short analysis received');
        await updateVideoWithError(videoId, 'The AI model returned an empty or too short analysis');
        return;
      }

      console.log(`Analysis received for video ${videoId}, length: ${analysis.length} characters`);

      // Step 7: Update the video with the analysis
      const updateData = {
        frame_analysis: analysis,
        summary: analysis.substring(0, 500) + (analysis.length > 500 ? '...' : ''),
        last_analyzed_at: new Date().toISOString()
      };

      const { error: updateError } = await supabase
        .from('tiktok_videos')
        .update(updateData)
        .eq('id', videoId);

      if (updateError) {
        console.error('Error updating video with analysis:', updateError);
        await updateVideoWithError(videoId, `Error updating video: ${updateError.message}`);
        return;
      }

      console.log(`Successfully updated video ${videoId} with analysis`);
    } catch (analysisError: any) {
      console.error('Error analyzing video with DashScope:', analysisError);
      console.error('Error details:', {
        message: analysisError.message || 'Unknown error',
        status: analysisError.response?.status,
        data: analysisError.response?.data
      });

      await updateVideoWithError(videoId, `Error analyzing video: ${analysisError.message || 'Unknown error'}`);
    }
  } catch (error: any) {
    console.error('Unexpected error in background analysis:', error);
    await updateVideoWithError(videoId, 'An unexpected error occurred during analysis');
  } finally {
    // Clean up the temporary file
    if (fileKey) {
      try {
        console.log(`Deleting temporary file from Supabase storage: ${fileKey}`);
        const { error: deleteError } = await supabase.storage
          .from('tiktok-videos')
          .remove([fileKey]);

        if (deleteError) {
          console.error(`Error deleting temporary file: ${deleteError.message}`);
        } else {
          console.log(`Successfully deleted temporary file: ${fileKey}`);
        }
      } catch (deleteError: any) {
        console.error(`Error deleting temporary file: ${deleteError.message}`);
      }
    }
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
