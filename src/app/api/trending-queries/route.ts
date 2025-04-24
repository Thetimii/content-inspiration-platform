import { NextResponse } from 'next/server';
import axios from 'axios';
import { supabase } from '@/utils/supabase';
import { sendRecommendationEmail } from '@/utils/brevoEmail';

// Server-side implementation of TikTok video scraping
async function scrapeTikTokVideosServer(query: string) {
  try {
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
          'X-RapidAPI-Key': '8776370b37mshbf38b974a097011p148539jsneaf34a1316b2',
          'X-RapidAPI-Host': 'tiktok-download-video1.p.rapidapi.com'
        }
      }
    );

    console.log('TikTok API response structure:', JSON.stringify(response.data).substring(0, 200) + '...');

    // Process and return the video data
    // Map the response to match our expected format
    if (response.data && response.data.data && Array.isArray(response.data.data.videos)) {
      // Log the first video item to see its structure
      if (response.data.data.videos.length > 0) {
        console.log('First video item structure:', JSON.stringify(response.data.data.videos[0]).substring(0, 1000) + '...');
      }

      return response.data.data.videos.map((item: any) => ({
        video_url: item.play || item.wmplay || '',
        caption: item.title || '',
        views: parseInt(item.play_count || '0', 10),
        likes: parseInt(item.digg_count || '0', 10),
        downloads: parseInt(item.download_count || '0', 10),
        hashtags: item.title ? item.title.match(/#[\w]+/g) || [] : [],
        cover_url: item.cover || item.origin_cover || '',
        download_url: item.download || item.wmplay || item.play || '',
      }));
    }

    // Last resort fallback
    if (response.data) {
      console.log('Unexpected API response structure, creating mock data');
      // Create mock data based on the query
      return [{
        video_url: `https://www.tiktok.com/search?q=${encodeURIComponent(query)}`,
        caption: `TikTok search results for: ${query}`,
        views: 1000,
        likes: 100,
        downloads: 0,
        hashtags: [query],
        cover_url: 'https://p16-sign-va.tiktokcdn.com/obj/tos-maliva-p-0068/oMn5k6iAARGBAAkARQkXECbF4AJDGQgXAT6BAg?x-expires=1714435200&x-signature=Ij%2FXzQFzMELxDPBmEZbhGGnOJnM%3D',
      }];
    }

    return [];
  } catch (error) {
    console.error('Error scraping TikTok videos on server:', error);
    // Create mock data as a fallback
    return [{
      video_url: `https://www.tiktok.com/search?q=${encodeURIComponent(query)}`,
      caption: `TikTok search results for: ${query}`,
      views: 1000,
      likes: 100,
      downloads: 0,
      hashtags: [query],
      cover_url: 'https://p16-sign-va.tiktokcdn.com/obj/tos-maliva-p-0068/oMn5k6iAARGBAAkARQkXECbF4AJDGQgXAT6BAg',
      download_url: `https://www.tiktok.com/search?q=${encodeURIComponent(query)}`,
    }];
  }
}

// Server-side implementation of trending query generation
async function generateTrendingQueriesServer(businessDescription: string) {
  try {
    // Check if API key is available
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error('OpenRouter API key is missing');
      throw new Error('OpenRouter API key is missing. Please add it to your environment variables.');
    }

    // Sanitize the API key - remove any whitespace or invalid characters
    const sanitizedApiKey = apiKey.trim();

    // Log sanitized key info
    console.log('Original API key length:', apiKey.length);
    console.log('Sanitized API key length:', sanitizedApiKey.length);
    console.log('First 5 chars of sanitized key:', sanitizedApiKey.substring(0, 5) + '...');

    // Check for common issues
    if (sanitizedApiKey.includes(' ')) {
      console.error('API key contains spaces');
    }
    if (sanitizedApiKey.includes('\n') || sanitizedApiKey.includes('\r')) {
      console.error('API key contains newlines');
    }

    // Log environment information for debugging
    console.log('Environment variables check:');
    console.log('- NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL || 'not set');
    console.log('- NODE_ENV:', process.env.NODE_ENV || 'not set');

    console.log('Generating trending queries for:', businessDescription);

    // Make the API call to OpenRouter
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'google/gemma-3-4b-it:free',
        messages: [
          {
            role: 'system',
            content: 'You are a TikTok trend expert. Respond with EXACTLY 5 trending search terms related to the business. ONLY provide the 5 keywords/phrases, one per line, numbered 1-5. NO explanations, NO descriptions, NO additional text. ONLY the 5 search terms. Example format:\n1. keyword1\n2. keyword2\n3. keyword3\n4. keyword4\n5. keyword5'
          },
          {
            role: 'user',
            content: businessDescription
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${sanitizedApiKey}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://lazy-trends.vercel.app',
          'X-Title': 'Lazy Trends',
          'Content-Type': 'application/json'
        }
      }
    );

    // Log the full response structure for debugging
    console.log('OpenRouter API response structure:', JSON.stringify(response.data, null, 2));

    // Extract and parse the search queries from the response
    const content = response.data?.choices?.[0]?.message?.content || '';
    console.log('OpenRouter API response content:', content.substring(0, 200));

    // Split by newlines and extract only the keywords
    const queries = content
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line && /^\d+\./.test(line)) // Only keep numbered lines
      .map((line: string) => line.replace(/^\d+\.\s*/, '').trim()) // Remove numbering and trim
      .filter(Boolean)
      .map((keyword: string) => keyword.replace(/["']/g, '')) // Remove any quotes
      .map((keyword: string) => keyword.replace(/^#/, '')); // Remove leading hashtag if present

    // Always return exactly 5 hashtags - no more, no less
    // If we have more than 5, take the first 5
    // If we have less than 5, throw an error - no fallbacks
    console.log('Parsed queries:', queries);

    if (queries.length !== 5) {
      if (queries.length < 5) {
        console.warn(`API returned only ${queries.length} queries, but exactly 5 are required.`);
        throw new Error(`API returned only ${queries.length} queries, but exactly 5 are required. Please try again.`);
      }
      // If more than 5, just take the first 5
      console.log('More than 5 queries returned, taking first 5');
    }

    // Return exactly 5 queries
    return queries.slice(0, 5);
  } catch (error: any) {
    console.error('Error generating trending queries on server:', error.message);

    if (error.response) {
      console.error('Error response status:', error.response.status);
      console.error('Error response data:', JSON.stringify(error.response.data).substring(0, 200));
    }

    // Check for authentication errors
    if (error.response?.status === 401 || error.message === 'API key not configured') {
      console.error('Authentication error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.message,
        apiKeyLength: process.env.OPENROUTER_API_KEY ? process.env.OPENROUTER_API_KEY.length : 0
      });
      throw new Error('OpenRouter API key is invalid or missing. Please check the API key in Vercel environment variables.');
    }

    // Check if it's an OpenRouter API key issue
    if (error.response?.status === 401 || error.response?.status === 403 ||
        error.message.includes('API key') || error.message.includes('Cannot read properties')) {
      console.error('OpenRouter API key issue detected:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.message,
        apiKeyLength: process.env.OPENROUTER_API_KEY ? process.env.OPENROUTER_API_KEY.length : 0
      });
      throw new Error('The OpenRouter API key is invalid or has reached its rate limit. Please check the API key in Vercel environment variables.');
    }

    // No fallbacks - throw the error to be handled by the caller
    console.error('API error occurred and no fallbacks are allowed:', error);
    throw new Error('Failed to generate trending queries. Please try again later or contact support if the issue persists.');
  }
}

export async function POST(request: Request) {
  try {
    const { businessDescription, userId } = await request.json();

    if (!businessDescription || !userId) {
      return NextResponse.json(
        { error: 'Business description and user ID are required' },
        { status: 400 }
      );
    }

    // Generate trending queries using server-side implementation - no fallbacks
    const queries = await generateTrendingQueriesServer(businessDescription);

    // Verify we have exactly 5 queries
    if (!queries || queries.length !== 5) {
      console.error(`Expected exactly 5 queries, but got ${queries?.length || 0}`);
      return NextResponse.json(
        { error: 'Failed to generate exactly 5 trending queries. Please try again.' },
        { status: 500 }
      );
    }

    console.log('Successfully generated 5 trending queries:', queries);

    // Save queries to database and scrape videos for each query
    const savedQueries: any[] = [];
    const allVideos: any[] = [];
    const videoIdsForAnalysis: string[] = [];

    // Process all queries
    for (const query of queries) {
      // Save query to database
      const { data, error } = await supabase
        .from('trend_queries')
        .insert({
          user_id: userId,
          query,
        })
        .select();

      if (error) {
        console.error('Error saving query:', error);
        // Skip the rest of the processing if there's an error
        return NextResponse.json(
          { error: 'Error saving query' },
          { status: 500 }
        );
      }

      if (data && data[0]) {
        const savedQuery = data[0];
        savedQueries.push(savedQuery);

        // Scrape videos for this query
        try {
          // Call the scrape-videos endpoint directly from server-side
          const videos = await scrapeTikTokVideosServer(query);

          // Save up to 5 videos per hashtag to database
          // We'll analyze 5 queries x 5 videos = 25 videos total
          const videosToSave = videos.slice(0, 5); // Take the first 5 videos
          console.log(`Saving ${videosToSave.length} videos for query: ${query}`);

          for (const video of videosToSave) {
            // Skip videos with missing required data
            if (!video.video_url) {
              console.warn('Skipping video with missing URL');
              continue;
            }

            const { data: videoData, error: videoError } = await supabase
              .from('tiktok_videos')
              .insert({
                trend_query_id: savedQuery.id,
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
        } catch (scrapeError) {
          console.error(`Error scraping videos for query "${query}":`, scrapeError);
          // Continue with other queries even if one fails
        }
      }
    }

    // Trigger video analysis for all videos we just scraped
    if (videoIdsForAnalysis.length > 0) {
      try {
        console.log(`Triggering analysis for ${videoIdsForAnalysis.length} videos...`);

        // We'll use the OpenRouter-based analysis instead of the video analyzer service

        // Create a background worker process to handle the analysis of all videos
        // This allows the API to return quickly while the analysis runs in a separate process
        const workerProcess = async () => {
          try {
            // Process videos one by one to avoid overwhelming the service
            for (let i = 0; i < videoIdsForAnalysis.length; i++) {
              const videoId = videoIdsForAnalysis[i];
              console.log(`Processing video ${i+1}/${videoIdsForAnalysis.length}: ${videoId}`);

              try {
                // Get the video URL and last_analyzed_at timestamp
                const { data: videoData, error: videoError } = await supabase
                  .from('tiktok_videos')
                  .select('video_url, last_analyzed_at')
                  .eq('id', videoId)
                  .single();

                if (videoError) {
                  console.error(`Error fetching video ${videoId}:`, videoError);
                  continue; // Skip to the next video
                }

                // Check if the video was analyzed within the last 24 hours
                const lastAnalyzedAt = videoData.last_analyzed_at ? new Date(videoData.last_analyzed_at) : null;
                const now = new Date();
                const hoursSinceLastAnalysis = lastAnalyzedAt
                  ? (now.getTime() - lastAnalyzedAt.getTime()) / (1000 * 60 * 60)
                  : 999; // Large number to ensure it passes the 24-hour check if never analyzed

                if (lastAnalyzedAt && hoursSinceLastAnalysis < 24) {
                  console.log(`Skipping analysis for video ${videoId} - last analyzed ${hoursSinceLastAnalysis.toFixed(1)} hours ago`);
                  continue; // Skip to the next video
                }

                console.log(`Starting analysis for video URL: ${videoData.video_url}`);

                // Set a flag in the database to indicate analysis is in progress
                await supabase
                  .from('tiktok_videos')
                  .update({ summary: 'Analysis in progress...' })
                  .eq('id', videoId);

                // Run the analysis with OpenRouter multimodal model
                try {
                  // Get the download URL if available
                  const { data: videoWithDownloadUrl, error: downloadUrlError } = await supabase
                    .from('tiktok_videos')
                    .select('download_url')
                    .eq('id', videoId)
                    .single();

                  if (downloadUrlError || !videoWithDownloadUrl.download_url) {
                    console.log(`No download URL found for video ${videoId}, using video_url instead`);
                  }

                  // Use download_url if available, otherwise fall back to video_url
                  const urlToAnalyze = videoWithDownloadUrl?.download_url || videoData.video_url;
                  console.log(`Using URL for analysis: ${urlToAnalyze}`);

                  // Import the analyzeVideoWithOpenRouter function
                  const { analyzeVideoWithOpenRouter } = await import('../analyze-video-openrouter/route');

                  // Set a timeout for the entire analysis process (10 minutes)
                  const analysisPromise = analyzeVideoWithOpenRouter(urlToAnalyze);

                  // Create a timeout promise
                  const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Analysis timed out after 10 minutes')), 10 * 60 * 1000);
                  });

                  // Race the analysis against the timeout
                  const analysis = await Promise.race([analysisPromise, timeoutPromise]) as {
                    summary: string;
                    transcript: string;
                    frames_analysis: any[];
                  };

                  // Update the video with the analysis results
                  console.log(`Updating video ${videoId} with summary`);
                  console.log('Summary content:', analysis.summary);

                  // First, try to update just the summary field and last_analyzed_at timestamp
                  const { error: updateError } = await supabase
                    .from('tiktok_videos')
                    .update({
                      summary: analysis.summary || 'Analysis completed but no summary was generated.',
                      last_analyzed_at: new Date().toISOString()
                    })
                    .eq('id', videoId);

                  // If that succeeded, update the other fields
                  if (!updateError) {
                    await supabase
                      .from('tiktok_videos')
                      .update({
                        transcript: analysis.transcript || '',
                        frame_analysis: analysis.frames_analysis && analysis.frames_analysis.length > 0
                          ? JSON.stringify(analysis.frames_analysis[0])
                          : null
                      })
                      .eq('id', videoId);
                  }

                  if (updateError) {
                    console.error(`Error updating video ${videoId} with analysis:`, updateError);
                    // If there was an error updating, try to set an error message
                    await supabase
                      .from('tiktok_videos')
                      .update({ summary: 'Error saving analysis results. Please try again.' })
                      .eq('id', videoId);
                  } else {
                    console.log(`Video ${videoId} analysis completed and saved successfully`);
                  }
                } catch (analysisError: any) {
                  console.error(`Error during video ${videoId} analysis:`, analysisError.message);
                  // Update the database with a more user-friendly error message
                  await supabase
                    .from('tiktok_videos')
                    .update({
                      summary: analysisError.message.includes('timed out')
                        ? 'Analysis timed out. The video may be too long or complex.'
                        : 'Error analyzing video. The service may be temporarily unavailable.'
                    })
                    .eq('id', videoId);
                }

                // Add a delay between videos to avoid overwhelming the service
                if (i < videoIdsForAnalysis.length - 1) {
                  console.log('Waiting 10 seconds before processing the next video...');
                  await new Promise(resolve => setTimeout(resolve, 10000)); // 10 second delay
                }
              } catch (videoError: any) {
                console.error(`Error processing video ${videoId}:`, videoError.message);
                // Continue with the next video
              }
            }

            console.log('All videos have been processed');

            // Generate a recommendation based on all analyzed videos
            try {
              console.log('Generating recommendation based on all analyzed videos...');

              // Wait a moment to ensure all database updates are complete
              await new Promise(resolve => setTimeout(resolve, 2000));

              // Call the generate-recommendation API
              const recommendationResponse = await fetch(new URL('/api/generate-recommendation', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'), {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  userId,
                  videoIds: videoIdsForAnalysis
                }),
              });

              if (!recommendationResponse.ok) {
                const errorData = await recommendationResponse.json();
                throw new Error(errorData.error || 'Failed to generate recommendation');
              }

              const recommendationData = await recommendationResponse.json();
              console.log('Recommendation generated successfully:', recommendationData.recommendation.id);

              // Send email notification if this is the first recommendation or it's been 24 hours
              try {
                // Get user data including email preferences
                const { data: userData, error: userError } = await supabase
                  .from('users')
                  .select('email_notifications, last_email_sent')
                  .eq('id', userId)
                  .single();

                if (userError) {
                  throw new Error(`Error fetching user data: ${userError.message}`);
                }

                // Check if email notifications are enabled
                if (userData.email_notifications !== false) {
                  // Check if this is the first recommendation or it's been 24 hours since the last email
                  const lastEmailSent = userData.last_email_sent ? new Date(userData.last_email_sent) : null;
                  const now = new Date();
                  const hoursSinceLastEmail = lastEmailSent
                    ? (now.getTime() - lastEmailSent.getTime()) / (1000 * 60 * 60)
                    : 999; // Large number to ensure it passes the 24-hour check if no previous email

                  if (!lastEmailSent || hoursSinceLastEmail >= 24) {
                    // Get user's email from auth
                    const { data: authData, error: authError } = await supabase.auth.admin.getUserById(userId);

                    if (authError || !authData?.user?.email) {
                      throw new Error(`Error fetching user email: ${authError?.message || 'No email found'}`);
                    }

                    // Get the recommendation details
                    const { data: recommendations, error: recError } = await supabase
                      .from('recommendations')
                      .select('*')
                      .eq('id', recommendationData.recommendation.id)
                      .single();

                    if (recError) {
                      throw new Error(`Error fetching recommendation details: ${recError.message}`);
                    }

                    // Send the email
                    await sendRecommendationEmail(
                      authData.user.email,
                      authData.user.user_metadata?.full_name || '',
                      [recommendations]
                    );

                    // Update last_email_sent timestamp
                    await supabase
                      .from('users')
                      .update({ last_email_sent: now.toISOString() })
                      .eq('id', userId);

                    console.log(`Email notification sent to ${authData.user.email}`);
                  } else {
                    console.log(`Skipping email notification - last email was sent ${hoursSinceLastEmail.toFixed(1)} hours ago`);
                  }
                } else {
                  console.log('Email notifications are disabled for this user');
                }
              } catch (emailError: any) {
                console.error('Error sending email notification:', emailError.message);
                // Continue even if email sending fails
              }
            } catch (recError: any) {
              console.error('Error generating recommendation:', recError.message);
              // Continue even if recommendation generation fails
            }
          } catch (error: any) {
            console.error('Error in background video analysis process:', error);
          }
        };

        // Start the worker process without waiting for it
        workerProcess().catch(error => {
          console.error('Unhandled error in worker process:', error);
        });

        console.log('Video analysis for all videos triggered in the background');
      } catch (analysisError) {
        console.error('Error setting up video analysis:', analysisError);
        // Continue even if analysis triggering fails
      }
    } // End of if (query) block

    return NextResponse.json({
      queries: savedQueries,
      videos: allVideos
    });
  } catch (error: any) {
    console.error('Error in trending-queries API route:', error);

    // Log additional debugging information
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      responseStatus: error.response?.status,
      responseData: error.response?.data ? JSON.stringify(error.response.data).substring(0, 200) : 'No response data'
    });

    // Check if it's an API key issue
    const errorMessage = error.message || 'An error occurred';
    const isApiKeyIssue = errorMessage.includes('API key') ||
                          errorMessage.includes('invalid') ||
                          errorMessage.includes('missing') ||
                          (error.response?.status === 401);

    return NextResponse.json(
      {
        error: errorMessage,
        isApiKeyIssue: isApiKeyIssue,
        suggestion: isApiKeyIssue ?
          'Please check that the OpenRouter API key is correctly configured in Vercel environment variables.' :
          'Please try again later or contact support if the issue persists.'
      },
      { status: 500 }
    );
  }
}
