import { NextResponse } from 'next/server';
import axios from 'axios';
import { supabase } from '@/utils/supabase';

// Server-side implementation of video analysis using OpenRouter's multimodal model
async function analyzeVideoWithOpenRouter(videoUrl: string) {
  try {
    console.log(`Starting analysis process for video using OpenRouter multimodal model: ${videoUrl}`);

    // Extract the download URL from the video URL if it's not already a direct download link
    // In our case, the videoUrl should already be the download_url from the TikTok API
    const downloadUrl = videoUrl;
    console.log(`Using download URL for analysis: ${downloadUrl}`);

    // Prepare the prompt for the multimodal model
    const prompt = `Analyze this TikTok video in detail. Please provide:
1. A comprehensive summary of what's happening in the video
2. Key visual elements and objects present
3. Any text or captions visible in the video
4. The overall theme or message of the content
5. What makes this content engaging or trending

Be specific and detailed in your analysis.`;

    console.log('Sending request to OpenRouter multimodal model...');

    // Make the API call to OpenRouter using the Qwen 2.5 VL model
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'qwen/qwen-2.5-vl-72b-instruct', // Multimodal model that can analyze images
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
                  url: downloadUrl
                }
              }
            ]
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
          'X-Title': 'Lazy Trends',
          'Content-Type': 'application/json'
        },
        timeout: 120000 // 120 seconds timeout for video processing
      }
    );

    console.log('OpenRouter response received');

    // Extract the analysis from the response
    let analysis = response.data.choices[0]?.message?.content || 'No analysis available';
    console.log('Analysis summary:', analysis.substring(0, 100) + '...');

    // Ensure the analysis is a string and not undefined or null
    if (!analysis) {
      analysis = 'No analysis available';
    }

    // Since we're not using the video analyzer service anymore, we won't have a transcript or frame analysis
    // Instead, we'll return the full analysis as the summary
    return {
      summary: analysis,
      transcript: '', // No transcript available with this method
      frames_analysis: [] // No frame analysis available with this method
    };
  } catch (error: any) {
    console.error(`Error analyzing video with OpenRouter: ${videoUrl}`, error.message);
    if (error.response) {
      console.error('Error response status:', error.response.status);
      console.error('Error response data:', error.response.data);
    }

    // In case of API failure, return a basic summary
    // This allows the app to continue functioning even if the API fails
    return {
      summary: `Error analyzing video: ${error.message}`,
      transcript: '',
      frames_analysis: []
    };
  }
}

export async function POST(request: Request) {
  try {
    const { videoIds } = await request.json();

    if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
      return NextResponse.json(
        { error: 'Video IDs array is required' },
        { status: 400 }
      );
    }

    console.log(`Batch analyzing ${videoIds.length} videos using OpenRouter...`);

    // Fetch videos from database
    const { data: videos, error: fetchError } = await supabase
      .from('tiktok_videos')
      .select('*')
      .in('id', videoIds);

    if (fetchError) {
      console.error('Error fetching videos:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch videos' },
        { status: 500 }
      );
    }

    if (!videos || videos.length === 0) {
      return NextResponse.json(
        { error: 'No videos found with the provided IDs' },
        { status: 404 }
      );
    }

    // Process videos sequentially to avoid overwhelming the API
    const results = [];

    // Process up to 25 videos (5 queries x 5 videos)
    const videosToProcess = videos.slice(0, 25);
    console.log(`Processing ${videosToProcess.length} videos out of ${videos.length} total`);

    for (const video of videosToProcess) {
      try {
        console.log(`Analyzing video: ${video.id} - ${video.download_url || video.video_url}`);

        // Skip videos that have been analyzed within the last 24 hours
        if (video.last_analyzed_at) {
          const lastAnalyzedAt = new Date(video.last_analyzed_at);
          const now = new Date();
          const hoursSinceLastAnalysis = (now.getTime() - lastAnalyzedAt.getTime()) / (1000 * 60 * 60);

          if (hoursSinceLastAnalysis < 24) {
            console.log(`Skipping video ${video.id} - last analyzed ${hoursSinceLastAnalysis.toFixed(1)} hours ago`);
            results.push({
              videoId: video.id,
              success: true,
              skipped: true,
              message: `Last analyzed ${hoursSinceLastAnalysis.toFixed(1)} hours ago`
            });
            continue;
          }
        }

        // Skip videos that already have a summary
        if (video.summary && video.summary !== 'Analysis in progress...') {
          console.log(`Video ${video.id} already has a summary, skipping analysis`);
          results.push({
            videoId: video.id,
            success: true,
            skipped: true,
            message: 'Video already has a summary'
          });
          continue;
        }

        // Check if we have a download URL
        if (!video.download_url) {
          console.log(`Video ${video.id} has no download URL, using video_url as fallback`);
          // We could update the download_url here if needed
        }

        // Use download_url if available, otherwise fall back to video_url
        const urlToAnalyze = video.download_url || video.video_url;

        // Analyze video
        const analysis = await analyzeVideoWithOpenRouter(urlToAnalyze);

        // Update video with summary
        console.log(`Updating video ${video.id} with summary`);
        console.log('Summary content:', analysis.summary);

        // First, try to update just the summary field and last_analyzed_at timestamp
        const { data, error } = await supabase
          .from('tiktok_videos')
          .update({
            summary: analysis.summary || 'No analysis available',
            last_analyzed_at: new Date().toISOString()
          })
          .eq('id', video.id)
          .select();

        // If that succeeded, update the other fields
        if (!error) {
          await supabase
            .from('tiktok_videos')
            .update({
              transcript: analysis.transcript || '',
              frame_analysis: null // No frame analysis with this method
            })
            .eq('id', video.id);
        }

        if (error) {
          console.error(`Error updating video ${video.id} with summary:`, error);
          results.push({
            videoId: video.id,
            success: false,
            error: 'Failed to update video with summary'
          });
        } else {
          results.push({
            videoId: video.id,
            success: true,
            summary: analysis.summary
          });
        }

        // Add a delay between videos to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay

      } catch (error: any) {
        console.error(`Error analyzing video ${video.id}:`, error);
        results.push({
          videoId: video.id,
          success: false,
          error: error.message || 'Unknown error'
        });
      }
    }

    // If there are more videos, schedule them for later processing
    if (videos.length > videosToProcess.length) {
      console.log(`Scheduling ${videos.length - videosToProcess.length} remaining videos for later processing`);
      // In a production app, you might want to implement a queue system
      // For now, we'll just log this information
    }

    return NextResponse.json({
      success: true,
      total: videoIds.length,
      processed: results.length,
      results
    });
  } catch (error: any) {
    console.error('Error in analyze-videos-batch-openrouter API route:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred' },
      { status: 500 }
    );
  }
}
