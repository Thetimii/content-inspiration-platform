import { TikTokVideo } from '@/types/analysis';

// Map of country names to TikTok API region codes
const countryToRegion: { [key: string]: string } = {
  'switzerland': 'CH',
  'united states': 'US',
  'germany': 'DE',
  'france': 'FR',
  'italy': 'IT',
  // Add more countries as needed
};

const RAPIDAPI_HOST = 'tiktok-download-video1.p.rapidapi.com';

async function getVideoDownloadUrl(videoUrl: string, apiKey: string): Promise<string> {
  try {
    const encodedUrl = encodeURIComponent(videoUrl);
    const url = `https://${RAPIDAPI_HOST}/getVideo?url=${encodedUrl}&hd=1`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': RAPIDAPI_HOST
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Download API Error Response:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error(`Download API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Download API Response:', JSON.stringify(data, null, 2));

    if (!data.data?.play_url) {
      throw new Error('No download URL found in response');
    }

    return data.data.play_url;
  } catch (error) {
    console.error('Error getting video download URL:', error);
    throw error;
  }
}

export async function searchTikTokVideos(query: string, location: string): Promise<TikTokVideo[]> {
  try {
    const region = countryToRegion[location.toLowerCase()] || 'US';
    
    const apiKey = process.env.NEXT_PUBLIC_RAPIDAPI_KEY;
    if (!apiKey) {
      throw new Error('RapidAPI key is not configured');
    }

    console.log('Using API Key:', apiKey.substring(0, 8) + '...');
    
    // Increase count to 5 to ensure we get enough videos to choose from
    const searchUrl = `https://${RAPIDAPI_HOST}/feedSearch?keywords=${encodeURIComponent(query)}&count=5&cursor=0&region=${region}&publish_time=1&sort_type=0`;
    console.log('Requesting Search URL:', searchUrl);

    const searchResponse = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': RAPIDAPI_HOST
      }
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('Search API Error Response:', {
        status: searchResponse.status,
        statusText: searchResponse.statusText,
        body: errorText
      });
      throw new Error(`Search API error: ${searchResponse.status} - ${errorText}`);
    }

    const searchData = await searchResponse.json();
    console.log('Search API Response:', JSON.stringify(searchData, null, 2));
    
    if (!searchData.data?.videos) {
      console.error('Unexpected API response format:', searchData);
      throw new Error('Invalid API response format');
    }

    // Process each video to get its download URL
    const processedVideos = await Promise.all(
      searchData.data.videos
        .filter((video: any) => video.video_id && (video.hdplay || video.play)) // Filter out videos without necessary data
        .map(async (video: any) => {
          const videoUrl = `https://www.tiktok.com/@${video.author?.unique_id || 'user'}/video/${video.video_id}`;
          const downloadUrl = video.hdplay || video.play || videoUrl;

          return {
            video_id: video.video_id,
            title: video.title || '',
            cover_url: video.origin_cover || video.cover || '',
            video_url: videoUrl,
            download_url: downloadUrl,
            author: video.author?.nickname || video.author?.unique_id || 'Unknown',
            stats: {
              play_count: parseInt(video.play_count || '0'),
              like_count: parseInt(video.digg_count || '0'),
              comment_count: parseInt(video.comment_count || '0'),
              share_count: parseInt(video.share_count || '0')
            },
            created_at: new Date().toISOString(),
            search_query: query
          };
        })
    );

    // Sort by engagement (like_count + comment_count + share_count) to get the most engaging videos
    return processedVideos
      .sort((a, b) => {
        const engagementA = a.stats.like_count + a.stats.comment_count + a.stats.share_count;
        const engagementB = b.stats.like_count + b.stats.comment_count + b.stats.share_count;
        return engagementB - engagementA;
      })
      .slice(0, 5); // Return top 5 most engaging videos
  } catch (error) {
    console.error('Error searching TikTok videos:', error);
    throw error;
  }
} 