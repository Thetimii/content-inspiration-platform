const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
const cors = require('cors');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Video analysis endpoint
app.post('/analyze', async (req, res) => {
  const { videoId, videoUrl, webhookUrl, webhookSecret } = req.body;

  if (!videoId || !videoUrl || !webhookUrl || !webhookSecret) {
    return res.status(400).json({
      error: 'Missing required parameters',
      required: ['videoId', 'videoUrl', 'webhookUrl', 'webhookSecret']
    });
  }

  // Respond immediately to prevent timeout
  res.json({
    status: 'processing',
    message: 'Video analysis started',
    videoId
  });

  // Process the video analysis in the background
  processVideoAnalysis(videoId, videoUrl, webhookUrl, webhookSecret).catch(error => {
    console.error(`Error processing video ${videoId}:`, error);
  });
});

/**
 * Process video analysis in the background
 */
async function processVideoAnalysis(videoId, videoUrl, webhookUrl, webhookSecret) {
  try {
    console.log(`[SERVICE] Starting analysis for video ${videoId}`);
    console.log(`[SERVICE] Video URL: ${videoUrl}`);

    // Get the DashScope API key
    const dashscopeApiKey = process.env.DASHSCOPE_API_KEY;
    
    if (!dashscopeApiKey) {
      console.error('[SERVICE] DashScope API key is missing');
      await callWebhook(webhookUrl, webhookSecret, {
        videoId,
        status: 'failed',
        error: 'DashScope API key is missing'
      });
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

    // Prepare the request payload for DashScope API
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
              { video: videoUrl, fps: 2 }, // Use fps: 2 to extract frames at 2 frames per second
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
    
    console.log('[SERVICE] Making API call to DashScope');
    
    try {
      // Make the API call to DashScope
      const response = await axios.post(
        'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
        requestBody,
        {
          headers,
          timeout: 300000 // 5 minutes timeout for video processing
        }
      );
      
      console.log('[SERVICE] Received response from DashScope API');
      console.log('[SERVICE] Response status:', response.status);
      
      // Extract the analysis from the response
      const analysis = response.data?.output?.text || '';
      
      if (!analysis || analysis.length < 10) {
        console.error('[SERVICE] Empty or too short analysis received');
        await callWebhook(webhookUrl, webhookSecret, {
          videoId,
          status: 'failed',
          error: 'The AI model returned an empty or too short analysis'
        });
        return;
      }
      
      console.log('[SERVICE] Analysis received, length:', analysis.length);
      console.log('[SERVICE] Analysis preview:', analysis.substring(0, 100) + '...');
      
      // Call the webhook with the analysis
      await callWebhook(webhookUrl, webhookSecret, {
        videoId,
        status: 'completed',
        analysis
      });
      
    } catch (error) {
      console.error('[SERVICE] Error analyzing video with DashScope:', error.message);
      
      let errorMessage = error.message || 'Unknown error';
      
      if (error.response) {
        console.error('[SERVICE] Response status:', error.response.status);
        
        try {
          console.error('[SERVICE] Response data:', JSON.stringify(error.response.data, null, 2));
          if (error.response.data && error.response.data.error) {
            errorMessage = `API Error: ${error.response.data.error.message || error.response.data.error}`;
          }
        } catch (jsonError) {
          console.error('[SERVICE] Error stringifying response data:', jsonError);
        }
      } else if (error.request) {
        console.error('[SERVICE] No response received from server');
        errorMessage = 'No response received from DashScope API (timeout or network issue)';
      }
      
      await callWebhook(webhookUrl, webhookSecret, {
        videoId,
        status: 'failed',
        error: errorMessage
      });
    }
  } catch (error) {
    console.error('[SERVICE] Unexpected error in background analysis:', error);
    
    await callWebhook(webhookUrl, webhookSecret, {
      videoId,
      status: 'failed',
      error: 'An unexpected error occurred during analysis'
    });
  }
}

/**
 * Call the webhook with the analysis results
 */
async function callWebhook(webhookUrl, webhookSecret, data) {
  try {
    console.log(`[SERVICE] Calling webhook for video ${data.videoId} with status ${data.status}`);
    
    const response = await axios.post(webhookUrl, data, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${webhookSecret}`
      },
      timeout: 10000 // 10 second timeout
    });
    
    console.log(`[SERVICE] Webhook response status: ${response.status}`);
  } catch (error) {
    console.error('[SERVICE] Error calling webhook:', error.message);
    
    if (error.response) {
      console.error('[SERVICE] Webhook response status:', error.response.status);
      console.error('[SERVICE] Webhook response data:', error.response.data);
    }
  }
}

// Start the server
app.listen(PORT, () => {
  console.log(`Video analysis service running on port ${PORT}`);
});
