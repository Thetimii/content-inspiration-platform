const { createClient } = require('@supabase/supabase-js');
const { OpenAI } = require('openai');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const stream = require('stream');
const { promisify } = require('util');
const pipeline = promisify(stream.pipeline);
const FormData = require('form-data');

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY
});

// Check if required libraries are installed
try {
  require('fluent-ffmpeg');
} catch (e) {
  // Install ffmpeg-related packages if they're missing
  console.log('Installing required packages...');
  execSync('npm install --no-save fluent-ffmpeg @ffmpeg-installer/ffmpeg get-video-duration');
}

// Now require libraries after potential installation
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const getVideoDurationInSeconds = require('get-video-duration').getVideoDurationInSeconds;

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

// Main handler function
module.exports = async (req, res) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { videoUrl, videoId, userId, searchQuery } = req.body;
  if (!videoUrl) {
    return res.status(400).json({ error: 'Video URL is required' });
  }

  console.log(`Analyzing video: ${videoUrl}`);
  
  // Create working directory
  const workDir = path.join('/tmp', `video-analysis-${Date.now()}`);
  
  try {
    // Ensure directory exists
    await fs.promises.mkdir(workDir, { recursive: true });
    const videoPath = path.join(workDir, 'video.mp4');
    
    console.log('Downloading video...');
    
    // Download the video
    try {
      await downloadFile(videoUrl, videoPath);
    } catch (downloadError) {
      console.error('Error downloading video:', downloadError);
      
      // Try alternate download method if first one fails
      try {
        await downloadFileWithAxios(videoUrl, videoPath);
      } catch (axiosError) {
        throw new Error(`Failed to download video: ${axiosError.message}`);
      }
    }
    
    console.log('Video downloaded successfully, extracting audio...');
    
    // Extract audio
    const audioPath = path.join(workDir, 'audio.mp3');
    await extractAudio(videoPath, audioPath);
    
    console.log('Audio extracted, transcribing with Whisper API...');
    
    // Transcribe audio using only Whisper
    let transcript = '';
    try {
      transcript = await transcribeAudio(audioPath);
      console.log('Transcription completed:', transcript);
    } catch (transcribeError) {
      console.error('Transcription error:', transcribeError);
      transcript = 'Audio transcription unavailable';
    }
    
    console.log('Extracting frames for analysis using model meta-llama/Llama-Vision-Free...');
    
    // Extract frames
    let framesPaths = [];
    try {
      framesPaths = await extractFrames(videoPath, workDir, 2);
      console.log(`Extracted ${framesPaths.length} frames`);
    } catch (frameError) {
      console.error('Error extracting frames:', frameError);
      // Create a thumbnail with ffmpeg as fallback
      try {
        const thumbnailPath = path.join(workDir, 'thumbnail.jpg');
        await createThumbnail(videoPath, thumbnailPath);
        framesPaths = [thumbnailPath];
      } catch (thumbError) {
        console.error('Failed to create thumbnail:', thumbError);
      }
    }
    
    console.log('Analyzing frames...');
    
    // Analyze frames using Llama-Vision-Free via openrouter
    let frameDescriptions = [];
    if (framesPaths.length > 0) {
      try {
        const analyses = await Promise.all(
          framesPaths.map(framePath => analyzeFrameWithLlama(framePath, searchQuery))
        );
        frameDescriptions = analyses.filter(Boolean);
        console.log('Frame analysis completed');
      } catch (visionError) {
        console.error('Error analyzing frames:', visionError);
      }
    }
    
    console.log('Reconstructing video description...');
    
    // Generate description
    let description = '';
    try {
      description = await generateDescriptionWithLlama(transcript, frameDescriptions, searchQuery);
      console.log('Successfully reconstructed video description');
    } catch (descError) {
      console.error('Error generating description:', descError);
      // Create a simple description as fallback
      description = `This video appears to be about ${searchQuery || 'various topics'}. ` +
                    `The content includes information that may be relevant to viewers interested in ${searchQuery || 'this subject'}.`;
    }
    
    // Get video metadata
    let duration = 'Unknown';
    try {
      duration = await getVideoDuration(videoPath);
    } catch (durationError) {
      console.error('Error getting duration:', durationError);
    }
    
    // Create final analysis
    const analysis = {
      transcript: transcript,
      description: description,
      metadata: {
        duration: duration,
        analyzed_at: new Date().toISOString(),
        search_query: searchQuery || 'general content'
      }
    };
    
    console.log('Storing analysis in database...');
    
    // Store in database
    if (userId && videoId) {
      try {
        const { error } = await supabase
          .from('video_analysis')
          .insert({
            user_id: userId,
            video_id: videoId,
            search_query: searchQuery || 'general content',
            analysis_result: analysis
          });
        
        if (error) {
          console.error('Database error:', error);
        } else {
          console.log('Analysis stored successfully');
        }
      } catch (dbError) {
        console.error('Error storing in database:', dbError);
      }
    }
    
    // Save output to a file (similar to the original analyzer)
    try {
      const outputDir = path.join(process.cwd(), 'output');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      fs.writeFileSync(path.join(outputDir, 'analysis.json'), JSON.stringify(analysis, null, 2));
      console.log('Analysis complete. Results saved to output/analysis.json');
    } catch (saveError) {
      console.error('Error saving analysis file:', saveError);
    }
    
    // Clean up
    try {
      await fs.promises.rm(workDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.error('Error cleaning up:', cleanupError);
    }
    
    return res.status(200).json({
      success: true,
      analysis
    });
    
  } catch (error) {
    console.error('Error in video analysis:', error);
    
    // Clean up on error
    try {
      if (fs.existsSync(workDir)) {
        await fs.promises.rm(workDir, { recursive: true, force: true });
      }
    } catch (cleanupError) {
      console.error('Error during cleanup:', cleanupError);
    }
    
    return res.status(500).json({
      success: false,
      error: error.message || 'An unexpected error occurred'
    });
  }
};

// Helper functions
async function downloadFile(url, dest) {
  const { promises: fs } = require('fs');
  const { default: fetch } = require('node-fetch');
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.statusText}`);
  }
  
  const buffer = await response.buffer();
  await fs.writeFile(dest, buffer);
}

async function downloadFileWithAxios(url, dest) {
  const writer = fs.createWriteStream(dest);
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream'
  });
  
  return new Promise((resolve, reject) => {
    response.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

async function extractAudio(videoPath, audioPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .output(audioPath)
      .audioCodec('libmp3lame')
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

async function transcribeAudio(audioPath) {
  // Use only OpenAI Whisper API for transcription
  try {
    const audioData = fs.createReadStream(audioPath);
    const transcription = await openai.audio.transcriptions.create({
      file: audioData,
      model: 'whisper-1',
      language: 'en'
    });
    
    return transcription.text;
  } catch (whisperError) {
    console.error('OpenAI transcription error:', whisperError);
    throw new Error(`Transcription failed: ${whisperError.message}`);
  }
}

async function extractFrames(videoPath, workDir, numFrames = 2) {
  const framesDir = path.join(workDir, 'frames');
  await fs.promises.mkdir(framesDir, { recursive: true });
  
  return new Promise((resolve, reject) => {
    const framePaths = [];
    
    ffmpeg(videoPath)
      .on('filenames', filenames => {
        filenames.forEach(name => {
          framePaths.push(path.join(framesDir, name));
        });
      })
      .on('end', () => resolve(framePaths))
      .on('error', reject)
      .screenshots({
        count: numFrames,
        folder: framesDir,
        filename: 'frame-%i.jpg'
      });
  });
}

async function createThumbnail(videoPath, thumbnailPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .screenshot({
        count: 1,
        filename: path.basename(thumbnailPath),
        folder: path.dirname(thumbnailPath),
        size: '640x?',
        timestamps: ['10%']
      })
      .on('end', resolve)
      .on('error', reject);
  });
}

// Analyze frame using Llama-Vision-Free via openrouter
async function analyzeFrameWithLlama(framePath, searchQuery) {
  // Use Llama-Vision-Free via OpenRouter
  try {
    const imageData = await fs.promises.readFile(framePath, { encoding: 'base64' });
    
    // Configure the request with max retries
    const maxRetries = 3;
    let attempt = 0;
    let lastError = null;
    
    while (attempt < maxRetries) {
      attempt++;
      
      try {
        const response = await axios.post(
          'https://openrouter.ai/api/v1/chat/completions',
          {
            model: 'meta-llama/Llama-Vision-Free',
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: `Analyze this frame from a video about "${searchQuery || 'general topics'}". 
                           Describe what you see in detail, including:
                           - People and their appearance
                           - Setting and background
                           - Objects and their arrangement
                           - Camera angle and framing
                           - Lighting conditions
                           - Overall mood/tone`
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:image/jpeg;base64,${imageData}`
                    }
                  }
                ]
              }
            ],
            max_tokens: 500
          },
          {
            headers: {
              'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        return response.data.choices[0].message.content;
      } catch (error) {
        console.error(`Request failed (attempt ${attempt}/${maxRetries}):`, error.message);
        lastError = error;
        
        // Check for retry-after header
        if (error.response && error.response.headers['retry-after']) {
          const retryAfter = parseInt(error.response.headers['retry-after'], 10) || 7;
          console.log(`Using Retry-After header value: ${retryAfter} seconds`);
          console.warn(`Waiting ${retryAfter} seconds before retry`);
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        } else {
          // Default backoff
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }
    
    throw lastError || new Error('Max retries exceeded');
  } catch (error) {
    console.error('Frame analysis error:', error);
    return null;
  }
}

// Generate description using Llama via openrouter
async function generateDescriptionWithLlama(transcript, frameDescriptions, searchQuery) {
  // Use Llama via OpenRouter to generate video description
  const frameText = frameDescriptions.length > 0 
    ? frameDescriptions.join('\n\n') 
    : 'No visual analysis available';
  
  // Configure the request with max retries
  const maxRetries = 3;
  let attempt = 0;
  let lastError = null;
  
  while (attempt < maxRetries) {
    attempt++;
    
    try {
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: 'meta-llama/Llama-3-70b-instruct', // Using Llama-3-70b
          messages: [
            {
              role: 'system',
              content: 'You are a professional video content analyst specialized in creating detailed descriptions of videos based on transcripts and visual elements.'
            },
            {
              role: 'user',
              content: `
              Create a detailed video description based on the following information:
              
              SEARCH TOPIC: ${searchQuery || 'General topic'}
              
              TRANSCRIPT:
              ${transcript || 'No transcript available'}
              
              VISUAL ANALYSIS:
              ${frameText}
              
              Format your response as "VIDEO SUMMARY" followed by a detailed description that covers:
              1. Duration (if known)
              2. What happens in the video
              3. Visual elements and equipment used
              4. Target audience
              5. Key tips for creating engaging videos in this style
              
              DO NOT include phrases like "Based on the transcript" or "According to the visual analysis" in your description.
              Write as if you've watched the entire video.
              `
            }
          ],
          temperature: 0.7,
          max_tokens: 1000
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data.choices[0].message.content;
    } catch (error) {
      console.error(`Request failed (attempt ${attempt}/${maxRetries}):`, error.message);
      lastError = error;
      
      // Check for retry-after header
      if (error.response && error.response.headers['retry-after']) {
        const retryAfter = parseInt(error.response.headers['retry-after'], 10) || 7;
        console.log(`Using Retry-After header value: ${retryAfter} seconds`);
        console.warn(`Waiting ${retryAfter} seconds before retry`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      } else {
        // Default backoff
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

async function getVideoDuration(videoPath) {
  try {
    const durationInSeconds = await getVideoDurationInSeconds(videoPath);
    const minutes = Math.floor(durationInSeconds / 60);
    const seconds = Math.floor(durationInSeconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } catch (error) {
    console.error('Error getting video duration:', error);
    return 'Unknown';
  }
} 