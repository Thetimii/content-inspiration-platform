// Import necessary packages
const { spawn } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { mkdir, readFile, rm } = require('fs/promises');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Paths to check for video-analyzer
const possiblePaths = [
  'video-analyzer',
  '/var/task/.vercel/cache/video-analyzer/bin/video-analyzer',
  '/var/task/node_modules/.bin/video-analyzer',
  '/opt/python/bin/video-analyzer',
  '/var/lang/bin/video-analyzer'
];

// Helper function to run video-analyzer
async function runVideoAnalyzer(videoUrl, outputDir) {
  // Try each possible path for video-analyzer
  for (const cmdPath of possiblePaths) {
    try {
      // Log the attempt
      console.log(`Trying video-analyzer at: ${cmdPath}`);
      
      // Run the command
      return await new Promise((resolve, reject) => {
        const cmd = spawn(cmdPath, [videoUrl, '--output-dir', outputDir]);
        
        let stdout = '';
        let stderr = '';
        
        cmd.stdout.on('data', (data) => {
          stdout += data.toString();
        });
        
        cmd.stderr.on('data', (data) => {
          stderr += data.toString();
          // Log stderr in real-time for debugging
          console.log('video-analyzer stderr:', data.toString());
        });
        
        cmd.on('close', (code) => {
          console.log(`video-analyzer exited with code ${code}`);
          if (code === 0) {
            resolve({ stdout, stderr });
          } else {
            reject(new Error(`video-analyzer failed with code ${code}: ${stderr}`));
          }
        });
        
        cmd.on('error', (err) => {
          console.error(`Failed to run ${cmdPath}:`, err);
          reject(err);
        });
      });
    } catch (err) {
      // Log the error and try the next path
      console.error(`Error with ${cmdPath}:`, err.message);
      continue;
    }
  }
  
  // If we get here, all paths failed
  throw new Error('Could not find or run video-analyzer');
}

module.exports = async (req, res) => {
  try {
    // Return 405 if not a POST request
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
    // Extract video URL and info from the request
    const { videoUrl, videoId, userId, searchQuery, videoTitle } = req.body;
    
    if (!videoUrl) {
      return res.status(400).json({ error: 'Video URL is required' });
    }

    console.log(`Analyzing video: ${videoUrl}`);
    
    // Create a unique output directory
    const outputDir = path.join('/tmp', `video-analysis-${uuidv4()}`);
    
    try {
      // Ensure output directory exists
      await mkdir(outputDir, { recursive: true });
      
      // Run video-analyzer
      const { stdout, stderr } = await runVideoAnalyzer(videoUrl, outputDir);
      
      console.log('Analysis completed:', stdout);
      
      // Read the analysis results
      const analysisJsonPath = path.join(outputDir, 'analysis.json');
      if (!fs.existsSync(analysisJsonPath)) {
        throw new Error('Analysis failed to generate output file');
      }
      
      const analysisJson = await readFile(analysisJsonPath, 'utf8');
      const analysis = JSON.parse(analysisJson);
      
      // Store the analysis in Supabase
      if (userId && videoId) {
        const { error: dbError } = await supabase
          .from('video_analysis')
          .insert({
            user_id: userId,
            video_id: videoId,
            search_query: searchQuery || 'general content',
            analysis_result: analysis
          });

        if (dbError) {
          console.error('Error storing analysis:', dbError);
        }
      }
      
      // Clean up
      try {
        await rm(outputDir, { recursive: true, force: true });
      } catch (err) {
        console.error('Error cleaning up:', err);
      }
      
      return res.status(200).json({ 
        success: true, 
        analysis 
      });
    } catch (error) {
      console.error('Analysis error:', error);
      
      // Clean up
      try {
        if (fs.existsSync(outputDir)) {
          await rm(outputDir, { recursive: true, force: true });
        }
      } catch (err) {
        console.error('Error cleaning up:', err);
      }
      
      return res.status(500).json({ 
        success: false, 
        error: error.message || 'Unknown error analyzing video'
      });
    }
  } catch (error) {
    console.error('Top level error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'An unexpected error occurred'
    });
  }
}; 