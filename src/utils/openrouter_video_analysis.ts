import axios from 'axios';

/**
 * Analyzes a video using OpenRouter's Qwen-2.5-VL multimodal model
 * @param videoUrl The URL of the video to analyze (must be a downloadable link)
 * @returns Analysis results including summary
 */
export async function analyzeVideoWithOpenRouter(videoUrl: string) {
  try {
    console.log(`Starting analysis of video using OpenRouter's Qwen-2.5-VL model: ${videoUrl}`);

    // Prepare the prompt for the multimodal model
    const prompt = `Analyze this TikTok video in detail. Please provide:
1. A comprehensive summary of what's happening in the video
2. Key visual elements and objects present
3. Any text or captions visible in the video
4. The overall theme or message of the content
5. What makes this content engaging or trending

Be specific and detailed in your analysis.`;

    // Get and sanitize the API key
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OpenRouter API key is missing');
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

    // Make the API call to OpenRouter using the Qwen-2.5-VL model
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'qwen/qwen-2.5-vl-72b-instruct', // Using the 72B parameter model for best results
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
                  url: videoUrl
                }
              }
            ]
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${sanitizedApiKey}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://lazy-trends.vercel.app',
          'X-Title': 'Lazy Trends',
          'Content-Type': 'application/json'
        },
        timeout: 120000 // 120 seconds timeout for video processing
      }
    );

    console.log('OpenRouter response received');

    // Extract the analysis from the response
    const analysis = response.data.choices[0]?.message?.content || 'No analysis available';
    console.log('Analysis summary:', analysis.substring(0, 100) + '...');

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
    return {
      summary: `Error analyzing video: ${error.message}`,
      transcript: '',
      frames_analysis: []
    };
  }
}
