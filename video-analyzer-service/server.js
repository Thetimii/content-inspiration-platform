const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Middleware
app.use(cors());
app.use(express.json());

// Ensure output directory exists
const outputDir = path.join(process.cwd(), 'output');
fs.mkdir(outputDir, { recursive: true }).catch(console.error);

// Health check endpoint
app.get('/', (req, res) => {
  res.status(200).send('Video Analyzer Service is running');
});

// Main analysis endpoint
app.post('/analyze', async (req, res) => {
  try {
    const { videoUrl, videoId, userId, searchQuery } = req.body;
    console.log('Starting video analysis:', { videoUrl, videoId, userId });

    if (!videoUrl || !videoId || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: videoUrl, videoId, or userId'
      });
    }

    // Store video metadata in temp_videos table
    const { error: insertError } = await supabase
      .from('temp_videos')
      .insert({
        user_id: userId,
        video_id: videoId,
        file_name: `${videoId}.mp4`,
        file_data: null, // Not storing the actual file data
        content_type: 'video/mp4'
      });
    
    if (insertError) {
      console.warn(`Warning: Failed to store video metadata: ${insertError.message}`);
      // Continue with analysis even if metadata storage fails
    } else {
      console.log('Video metadata stored in database successfully');
    }

    // Run video-analyzer directly on the URL
    const analyzer = spawn('video-analyzer', [
      videoUrl,
      '--client', 'openai_api',
      '--api-key', process.env.TOGETHER_API_KEY,
      '--api-url', 'https://api.together.xyz/v1',
      '--model', 'meta-llama/Llama-Vision-Free',
      '--max-frames', '2',
      '--duration', '60',
      '--log-level', 'INFO',
      '--whisper-model', 'medium',
      '--temperature', '0.7',
      '--prompt', 'Analyze this TikTok video and provide insights about: 1. Main activities shown 2. Visual elements and equipment 3. Style and techniques 4. Target audience 5. Key tips. Keep the analysis concise.'
    ]);

    let errorText = '';

    // Collect stderr for logging
    analyzer.stderr.on('data', (data) => {
      const text = data.toString();
      errorText += text;
      console.log('video-analyzer stderr:', text);
    });

    // Wait for the analyzer to complete
    await new Promise((resolve, reject) => {
      analyzer.on('close', (code) => {
        console.log(`Analyzer process exited with code ${code}`);
        if (code !== 0) {
          console.error('STDERR:', errorText);
        }
        resolve();
      });
      analyzer.on('error', (err) => {
        console.error('Analyzer process error:', err);
        reject(err);
      });
    });

    // Read the analysis from the output file
    const analysisFilePath = path.join(outputDir, 'analysis.json');
    console.log('Reading analysis from:', analysisFilePath);
    
    let analysisText;
    try {
      const fileContent = await fs.readFile(analysisFilePath, 'utf-8');
      const analysisJson = JSON.parse(fileContent);
      
      // Extract only the video_description section
      if (analysisJson.video_description?.response) {
        analysisText = analysisJson.video_description.response;
        console.log('Successfully extracted video description');
      } else {
        throw new Error('Video description not found in analysis output');
      }
    } catch (error) {
      console.error('Error reading/parsing analysis file:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to read or parse analysis output file'
      });
    }

    // Save the analysis to Supabase
    console.log('Saving analysis to Supabase for video ID:', videoId);
    
    const { error: saveError } = await supabase
      .from('video_analysis')
      .upsert({
        user_id: userId,
        video_id: videoId,
        search_query: searchQuery || '',
        analysis_result: analysisText,
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (saveError) {
      console.error('Error saving to Supabase:', saveError);
      return res.status(500).json({
        success: false,
        error: `Database error: ${saveError.message}`
      });
    }

    // Clean up the output file
    try {
      await fs.unlink(analysisFilePath);
      console.log('Cleaned up analysis file');
    } catch (error) {
      console.warn('Warning: Could not clean up analysis file:', error);
    }

    return res.json({
      success: true,
      result: analysisText
    });
  } catch (error) {
    console.error('Error in video analysis:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Video Analyzer Service running on port ${PORT}`);
});
