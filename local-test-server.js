const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3001;

// Enable CORS
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Serve static files
app.use(express.static('public'));

// Create public directory if it doesn't exist
if (!fs.existsSync('public')) {
  fs.mkdirSync('public');
}

// Create a simple HTML page for testing
const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DashScope API Test</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    .container {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .video-container {
      width: 100%;
    }
    video {
      width: 100%;
      max-height: 400px;
    }
    .result-container {
      border: 1px solid #ccc;
      padding: 20px;
      border-radius: 5px;
      min-height: 200px;
      max-height: 500px;
      overflow-y: auto;
      white-space: pre-wrap;
    }
    .log-container {
      border: 1px solid #ccc;
      padding: 20px;
      border-radius: 5px;
      min-height: 200px;
      max-height: 300px;
      overflow-y: auto;
      background-color: #f5f5f5;
      font-family: monospace;
    }
    button {
      padding: 10px 20px;
      background-color: #4CAF50;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 16px;
    }
    button:hover {
      background-color: #45a049;
    }
    button:disabled {
      background-color: #cccccc;
      cursor: not-allowed;
    }
    .status {
      font-weight: bold;
      margin-bottom: 10px;
    }
    .loading {
      display: inline-block;
      width: 20px;
      height: 20px;
      border: 3px solid rgba(0, 0, 0, 0.3);
      border-radius: 50%;
      border-top-color: #000;
      animation: spin 1s ease-in-out infinite;
      margin-left: 10px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <h1>DashScope API Test</h1>
  <div class="container">
    <div class="video-container">
      <h2>Test Video</h2>
      <video controls>
        <source src="https://cxtystgaxoeygwbvgqcg.supabase.co/storage/v1/object/public/tiktok-videos/tiktok-videos/d6a1c5d5-b0f7-4a85-8345-8bd0c76a4a36-1745606628578.mp4" type="video/mp4">
        Your browser does not support the video tag.
      </video>
    </div>
    
    <div>
      <button id="analyzeBtn">Analyze Video</button>
      <div class="status" id="status"></div>
    </div>
    
    <div>
      <h2>Analysis Result</h2>
      <div class="result-container" id="result">Click "Analyze Video" to start analysis</div>
    </div>
    
    <div>
      <h2>Logs</h2>
      <div class="log-container" id="logs"></div>
    </div>
  </div>

  <script>
    const analyzeBtn = document.getElementById('analyzeBtn');
    const statusEl = document.getElementById('status');
    const resultEl = document.getElementById('result');
    const logsEl = document.getElementById('logs');
    
    function addLog(message) {
      const timestamp = new Date().toLocaleTimeString();
      logsEl.innerHTML += `[${timestamp}] ${message}\\n`;
      logsEl.scrollTop = logsEl.scrollHeight;
    }
    
    analyzeBtn.addEventListener('click', async () => {
      try {
        analyzeBtn.disabled = true;
        statusEl.innerHTML = 'Analyzing... <div class="loading"></div>';
        resultEl.textContent = 'Analysis in progress...';
        logsEl.textContent = '';
        
        addLog('Starting analysis...');
        
        const response = await fetch('/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            videoUrl: 'https://cxtystgaxoeygwbvgqcg.supabase.co/storage/v1/object/public/tiktok-videos/tiktok-videos/d6a1c5d5-b0f7-4a85-8345-8bd0c76a4a36-1745606628578.mp4'
          })
        });
        
        if (!response.ok) {
          throw new Error('Failed to start analysis');
        }
        
        addLog('Analysis started, streaming results...');
        
        const reader = response.body.getReader();
        let decoder = new TextDecoder();
        let buffer = '';
        
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            addLog('Stream complete');
            break;
          }
          
          buffer += decoder.decode(value, { stream: true });
          
          // Process complete messages
          const lines = buffer.split('\\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.trim()) {
              try {
                const data = JSON.parse(line);
                addLog(`Received update: ${data.type}`);
                
                if (data.type === 'log') {
                  addLog(data.message);
                } else if (data.type === 'progress') {
                  statusEl.innerHTML = `${data.message} <div class="loading"></div>`;
                } else if (data.type === 'result') {
                  resultEl.textContent = data.analysis;
                  statusEl.textContent = 'Analysis complete!';
                  analyzeBtn.disabled = false;
                } else if (data.type === 'error') {
                  resultEl.textContent = `Error: ${data.message}`;
                  statusEl.textContent = 'Analysis failed';
                  analyzeBtn.disabled = false;
                }
              } catch (e) {
                addLog(`Error parsing message: ${line}`);
              }
            }
          }
        }
      } catch (error) {
        addLog(`Error: ${error.message}`);
        resultEl.textContent = `Error: ${error.message}`;
        statusEl.textContent = 'Analysis failed';
        analyzeBtn.disabled = false;
      }
    });
  </script>
</body>
</html>
`;

fs.writeFileSync('public/index.html', htmlContent);

// Endpoint to analyze video
app.post('/analyze', async (req, res) => {
  const { videoUrl } = req.body;
  
  if (!videoUrl) {
    return res.status(400).json({ error: 'Video URL is required' });
  }
  
  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Helper function to send SSE messages
  const sendMessage = (type, data) => {
    res.write(JSON.stringify({ type, ...data }) + '\n');
  };
  
  try {
    // Send initial message
    sendMessage('log', { message: 'Starting analysis...' });
    
    // Get the DashScope API key
    const dashscopeApiKey = process.env.DASHSCOPE_API_KEY;
    
    if (!dashscopeApiKey) {
      sendMessage('error', { message: 'DashScope API key is missing' });
      return res.end();
    }
    
    sendMessage('log', { message: `DashScope API key available: ${dashscopeApiKey ? 'Yes' : 'No'}` });
    sendMessage('log', { message: `DashScope API key length: ${dashscopeApiKey.length}` });
    
    // Log the first few characters of the API key for debugging (don't log the full key)
    if (dashscopeApiKey.length > 8) {
      sendMessage('log', { message: `DashScope API key prefix: ${dashscopeApiKey.substring(0, 4)}...${dashscopeApiKey.substring(dashscopeApiKey.length - 4)}` });
    }
    
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
                url: videoUrl 
              }
            },
            {
              type: "text",
              text: "Analyze this TikTok video in detail. Please provide:\n1. A comprehensive summary of what's happening in the video\n2. Key visual elements and objects present\n3. Any text or captions visible in the video\n4. The overall theme or message of the content\n5. What makes this content engaging or trending\n\nBe specific and detailed in your analysis."
            }
          ]
        }
      ],
      max_tokens: 2048,
      temperature: 0.7
    };
    
    // Prepare the headers
    const headers = {
      'Authorization': `Bearer ${dashscopeApiKey.trim()}`,
      'Content-Type': 'application/json'
    };
    
    sendMessage('progress', { message: 'Making DashScope API call...' });
    sendMessage('log', { message: 'Request payload prepared' });
    
    try {
      sendMessage('log', { message: 'Sending request to DashScope API...' });
      
      const dashscopeResponse = await axios.post(
        'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
        requestPayload,
        {
          headers,
          timeout: 120000 // 2 minute timeout
        }
      );
      
      sendMessage('log', { message: 'DashScope API response received' });
      sendMessage('log', { message: `Response status: ${dashscopeResponse.status}` });
      
      // Extract the analysis from the response
      const analysis = dashscopeResponse.data?.choices?.[0]?.message?.content || '';
      
      if (!analysis || analysis.length < 10) {
        sendMessage('error', { message: 'Empty or too short analysis received' });
        return res.end();
      }
      
      sendMessage('log', { message: `Analysis received, length: ${analysis.length} characters` });
      sendMessage('result', { analysis });
      
    } catch (apiError) {
      sendMessage('log', { message: `Error calling DashScope API: ${apiError.message}` });
      
      if (apiError.response) {
        sendMessage('log', { message: `Status: ${apiError.response.status}` });
        sendMessage('log', { message: `Data: ${JSON.stringify(apiError.response.data)}` });
      }
      
      // Try with a simpler approach
      try {
        sendMessage('progress', { message: 'Trying with a simpler approach...' });
        
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
                    url: videoUrl 
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
        
        sendMessage('log', { message: 'Making simple DashScope API call' });
        
        const simpleResponse = await axios.post(
          'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
          simplePrompt,
          {
            headers,
            timeout: 60000 // 1 minute timeout
          }
        );
        
        const simpleAnalysis = simpleResponse.data?.choices?.[0]?.message?.content || '';
        
        if (simpleAnalysis && simpleAnalysis.length > 10) {
          sendMessage('log', { message: 'Simple analysis received' });
          sendMessage('result', { 
            analysis: `Simple analysis (limited due to video processing constraints):\n\n${simpleAnalysis}` 
          });
        } else {
          throw new Error('Simple analysis also failed');
        }
      } catch (simpleError) {
        sendMessage('log', { message: `Simple approach also failed: ${simpleError.message}` });
        sendMessage('error', { message: 'Multiple analysis attempts failed. The video may be too complex or too long.' });
      }
    }
  } catch (error) {
    sendMessage('log', { message: `Unexpected error: ${error.message}` });
    sendMessage('error', { message: 'An unexpected error occurred' });
  } finally {
    res.end();
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
