const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Get the RapidAPI key from environment variables
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

// Main handler function
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { searchQuery, userId, limit = 3 } = req.body;

  if (!searchQuery) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  if (!RAPIDAPI_KEY) {
    return res.status(500).json({ error: 'RapidAPI key is not configured' });
  }

  try {
    console.log(`Scraping TikTok videos for query: "${searchQuery}"`);
    
    // Make request to TikTok API via RapidAPI
    const options = {
      method: 'GET',
      url: 'https://tiktok-video-no-watermark2.p.rapidapi.com/feed/search',
      params: {
        keywords: searchQuery,
        count: limit.toString(),
        cursor: '0'
      },
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'tiktok-video-no-watermark2.p.rapidapi.com'
      }
    };

    const response = await axios.request(options);
    
    if (!response.data || !response.data.data || !Array.isArray(response.data.data.videos)) {
      return res.status(500).json({ 
        error: 'Invalid API response structure',
        response: response.data
      });
    }

    // Process and extract relevant video data
    const videos = response.data.data.videos.map(video => ({
      id: video.aweme_id,
      author: video.author ? video.author.nickname : 'Unknown',
      description: video.desc || '',
      playUrl: video.play || '',
      coverUrl: video.origin_cover || '',
      duration: video.duration || 0,
      createTime: video.create_time || Date.now(),
      search_query: searchQuery
    }));

    console.log(`Found ${videos.length} videos for query "${searchQuery}"`);

    // Store videos in database if userId is provided
    if (userId) {
      try {
        for (const video of videos) {
          const { error } = await supabase
            .from('scraped_videos')
            .insert({
              user_id: userId,
              video_id: video.id,
              search_query: searchQuery,
              author: video.author,
              description: video.description,
              play_url: video.playUrl,
              cover_url: video.coverUrl,
              duration: video.duration,
              created_at: new Date(video.createTime * 1000).toISOString()
            });
          
          if (error) {
            console.error('Database error:', error);
          }
        }
        console.log('Videos stored successfully in database');
      } catch (dbError) {
        console.error('Error storing videos in database:', dbError);
      }
    }

    return res.status(200).json({
      success: true,
      videos
    });
  } catch (error) {
    console.error('Error scraping videos:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to scrape videos'
    });
  }
}; 