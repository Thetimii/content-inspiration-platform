import axios from 'axios';

// OpenRouter API for generating trending search queries
export async function generateTrendingQueries(businessDescription: string) {
  try {
    console.log('Generating trending queries for:', businessDescription);

    // Make the actual API call to OpenRouter
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
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY || ''}`,
          'HTTP-Referer': typeof window !== 'undefined' ? window.location.href : 'https://lazy-trends.vercel.app',
          'X-Title': 'Lazy Trends',
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('OpenRouter API response received');

    // Extract and parse the search queries from the response
    const content = response.data.choices[0]?.message?.content || '';

    // Split by newlines and extract only the keywords
    const queries = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && /^\d+\./.test(line)) // Only keep numbered lines
      .map(line => line.replace(/^\d+\.\s*/, '').trim()) // Remove numbering and trim
      .filter(Boolean)
      .map(keyword => keyword.replace(/["']/g, '')) // Remove any quotes
      .map(keyword => keyword.replace(/^#/, '')); // Remove leading hashtag if present

    console.log('Parsed queries:', queries);

    // Always return exactly 5 hashtags - no more, no less
    if (queries.length !== 5) {
      if (queries.length < 5) {
        console.warn(`API returned only ${queries.length} queries, but exactly 5 are required.`);
        // Add fallback queries to make up the difference
        const fallbackQueries = [
          `${businessDescription} tips`,
          `${businessDescription} tutorial`,
          `${businessDescription} trends`,
          `${businessDescription} ideas`,
          `${businessDescription} hacks`
        ];

        // Add fallback queries until we have 5
        for (const query of fallbackQueries) {
          if (!queries.includes(query) && queries.length < 5) {
            queries.push(query);
          }
        }
      }
      // If more than 5, just take the first 5
    }

    return queries.slice(0, 5);
  } catch (error: any) {
    console.error('Error generating trending queries:', error.message);
    if (error.response) {
      console.error('Error response status:', error.response.status);
      console.error('Error response data:', error.response.data);
    }

    // Provide fallback queries in case of API failure
    const fallbackQueries = [
      `${businessDescription} tips`,
      `${businessDescription} tutorial`,
      `${businessDescription} trends`,
      `${businessDescription} ideas`,
      `${businessDescription} hacks`
    ];

    console.log('Using fallback queries:', fallbackQueries);
    return fallbackQueries;
  }
}

// RapidAPI TikTok scraping
export async function scrapeTikTokVideos(query: string) {
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
      }];
    }

    return [];
  } catch (error) {
    console.error('Error scraping TikTok videos:', error);
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

// Video Analyzer API - Multi-step process
export async function analyzeVideo(videoUrl: string) {
  try {
    console.log(`Starting analysis process for video: ${videoUrl}`);

    // Step 1: Register the video URL
    console.log('Step 1: Registering video URL...');
    const registerResponse = await axios.post(
      `${process.env.VIDEO_ANALYZER_URL || 'https://video-analyzer-y3m4k6qhqq-uc.a.run.app'}/upload-url`,
      { url: videoUrl },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 seconds timeout
      }
    );

    const sessionId = registerResponse.data.session_id;
    console.log(`Video registered successfully with session ID: ${sessionId}`);

    // Step 2: Start the analysis
    console.log('Step 2: Starting video analysis...');
    const formData = new URLSearchParams();
    formData.append('client', 'openrouter');
    formData.append('api-key', process.env.OPENROUTER_API_KEY || '');
    formData.append('model', 'meta-llama/llama-4-maverick:free');
    formData.append('max-frames', '3'); // Limit to 3 frames to avoid rate limits
    formData.append('whisper-model', 'tiny'); // Use tiny model for faster processing
    formData.append('duration', '30'); // Limit to 30 seconds of the video

    const startResponse = await axios.post(
      `${process.env.VIDEO_ANALYZER_URL || 'https://video-analyzer-y3m4k6qhqq-uc.a.run.app'}/analyze/${sessionId}`,
      formData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 30000 // 30 seconds timeout
      }
    );

    console.log('Analysis started successfully, waiting for results...');

    // Step 3: Wait a bit for processing (this is a simplified approach)
    // In a production app, you might want to implement polling or use the stream endpoint
    await new Promise(resolve => setTimeout(resolve, 15000)); // Wait 15 seconds

    // Step 4: Get the results
    console.log('Step 4: Retrieving analysis results...');
    let attempts = 0;
    let resultsData = null;

    // Try up to 5 times with increasing delays
    while (attempts < 5 && !resultsData) {
      try {
        const resultsResponse = await axios.get(
          `${process.env.VIDEO_ANALYZER_URL || 'https://video-analyzer-y3m4k6qhqq-uc.a.run.app'}/results/${sessionId}`,
          { timeout: 30000 }
        );

        resultsData = resultsResponse.data;
        console.log('Analysis results retrieved successfully');
      } catch (error: any) {
        attempts++;
        console.log(`Attempt ${attempts} failed, waiting before retry...`);

        // Exponential backoff: 5s, 10s, 20s, 40s, 80s
        const waitTime = Math.pow(2, attempts) * 2500;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    if (!resultsData) {
      throw new Error('Failed to retrieve analysis results after multiple attempts');
    }

    // Process and return the results
    const summary = resultsData.video_description?.response || 'No summary available';
    const transcript = resultsData.transcript?.text || '';
    const frameAnalyses = resultsData.frame_analyses || [];

    return {
      summary,
      transcript,
      frames_analysis: frameAnalyses
    };
  } catch (error: any) {
    console.error(`Error analyzing video: ${videoUrl}`, error.message);
    if (error.response) {
      console.error('Error response status:', error.response.status);
      console.error('Error response data:', error.response.data);
    }

    // In case of API failure, return a basic summary
    // This allows the app to continue functioning even if the API fails
    return {
      summary: 'Video analysis unavailable. Please try again later.',
      transcript: '',
      frames_analysis: []
    };
  }
}
