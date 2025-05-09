import { NextResponse } from 'next/server';
import axios from 'axios';
import { supabase } from '@/utils/supabase';

/**
 * API endpoint to directly analyze a single video
 * This version downloads the MP4 file to Supabase storage and passes the URL to the AI
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
    console.error('Unexpected error in direct-analyze-mp4 route:', error);
    
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
async function analyzeVideoInBackground(videoId: string, videoUrl: string) {
  let fileKey = '';
  
  try {
    console.log(`Starting background analysis for video ${videoId}`);
    console.log(`Using video URL: ${videoUrl}`);

    // Get the OpenRouter API key
    const openRouterApiKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterApiKey) {
      console.error('OpenRouter API key is missing');
      await updateVideoWithError(videoId, 'OpenRouter API key is missing');
      return;
    }

    // Create the storage bucket if it doesn't exist
    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.find(bucket => bucket.name === 'tiktok-videos')) {
      console.log('Creating storage bucket tiktok-videos');
      const { error: bucketError } = await supabase.storage.createBucket('tiktok-videos', {
        public: true
      });
      
      if (bucketError) {
        console.error('Error creating storage bucket:', bucketError);
        await updateVideoWithError(videoId, `Error creating storage bucket: ${bucketError.message}`);
        return;
      }
    } else {
      console.log('Storage bucket tiktok-videos already exists');
    }

    // Download the video file
    console.log(`Downloading video file from ${videoUrl}`);
    let videoBuffer;
    
    try {
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
    
    // Generate a unique file name
    fileKey = `temp-videos/${videoId}-${Date.now()}.mp4`;
    
    // Upload the file to Supabase storage
    console.log(`Uploading video file to Supabase storage: ${fileKey}`);
    const { error: uploadError } = await supabase.storage
      .from('tiktok-videos')
      .upload(fileKey, videoBuffer, {
        contentType: 'video/mp4',
        cacheControl: '3600'
      });
    
    if (uploadError) {
      console.error(`Error uploading to Supabase storage: ${uploadError.message}`);
      await updateVideoWithError(videoId, `Error uploading to Supabase storage: ${uploadError.message}`);
      return;
    }
    
    // Get the public URL for the file
    const { data: publicUrlData } = supabase.storage
      .from('tiktok-videos')
      .getPublicUrl(fileKey);
    
    const supabaseFileUrl = publicUrlData.publicUrl;
    console.log(`Public URL for video file: ${supabaseFileUrl}`);

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
      
      // Prepare the request payload
      const requestPayload = {
        model: "qwen/qwen-2.5-vl-72b-instruct",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { 
                type: "image_url", 
                image_url: { 
                  url: supabaseFileUrl 
                } 
              }
            ]
          }
        ]
      };
      
      // Prepare the headers
      const headers = {
        'Authorization': `Bearer ${openRouterApiKey.trim()}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://lazy-trends.vercel.app',
        'X-Title': 'Lazy Trends',
        'Content-Type': 'application/json'
      };
      
      console.log('Making OpenRouter API call with model: qwen/qwen-2.5-vl-72b-instruct');
      console.log('Request payload:', JSON.stringify(requestPayload, null, 2));
      
      const openRouterResponse = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        requestPayload,
        {
          headers,
          timeout: 120000 // 2 minute timeout
        }
      );
      
      console.log('OpenRouter API response received');
      console.log('Response status:', openRouterResponse.status);
      
      // Log the full response for debugging
      console.log('OpenRouter response data:', JSON.stringify(openRouterResponse.data, null, 2));
      
      // Extract the analysis from the response
      const analysis = openRouterResponse.data?.choices?.[0]?.message?.content || '';
      
      // Log the extracted analysis
      console.log('Extracted analysis:', analysis ? (analysis.length > 100 ? analysis.substring(0, 100) + '...' : analysis) : 'null');
      
      if (!analysis || analysis.length < 10) {
        console.error('Empty or too short analysis received');
        await updateVideoWithError(videoId, 'The AI model returned an empty or too short analysis');
        return;
      }
      
      console.log(`Analysis received for video ${videoId}, length: ${analysis.length} characters`);
      
      // Update the video with the analysis
      console.log(`Updating video ${videoId} in database with analysis...`);
      
      const updateData = {
        frame_analysis: analysis,
        summary: analysis.substring(0, 500) + (analysis.length > 500 ? '...' : ''),
        last_analyzed_at: new Date().toISOString()
      };
      
      console.log('Update data:', {
        frame_analysis_length: updateData.frame_analysis.length,
        summary_length: updateData.summary.length,
        last_analyzed_at: updateData.last_analyzed_at
      });
      
      const { error: updateError } = await supabase
        .from('tiktok_videos')
        .update(updateData)
        .eq('id', videoId);
      
      if (updateError) {
        console.error('Error updating video with analysis:', updateError);
        console.error('Update error details:', JSON.stringify(updateError, null, 2));
        return;
      }
      
      console.log(`Successfully updated video ${videoId} with analysis`);
      
      // Verify the update by fetching the video again
      const { data: updatedVideo, error: fetchError } = await supabase
        .from('tiktok_videos')
        .select('id, frame_analysis, last_analyzed_at')
        .eq('id', videoId)
        .single();
        
      if (fetchError) {
        console.error('Error verifying update:', fetchError);
      } else {
        console.log('Verified update:', {
          id: updatedVideo.id,
          frame_analysis_length: updatedVideo.frame_analysis ? updatedVideo.frame_analysis.length : 0,
          last_analyzed_at: updatedVideo.last_analyzed_at
        });
      }
    } catch (error: any) {
      console.error('Error analyzing video with OpenRouter:', error);
      console.error('Error details:', {
        message: error.message || 'Unknown error',
        status: error.response?.status,
        data: error.response?.data
      });
      
      await updateVideoWithError(videoId, `Error analyzing video: ${error.message || 'Unknown error'}`);
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
  } catch (error: any) {
    console.error('Unexpected error in background analysis:', error);
    await updateVideoWithError(videoId, 'An unexpected error occurred during analysis');
    
    // Clean up the temporary file if there was an error
    if (fileKey) {
      try {
        console.log(`Cleaning up temporary file after error: ${fileKey}`);
        await supabase.storage
          .from('tiktok-videos')
          .remove([fileKey]);
      } catch (cleanupError) {
        console.error('Error cleaning up temporary file:', cleanupError);
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
