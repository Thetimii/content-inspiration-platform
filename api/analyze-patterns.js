const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Helper to safely extract text from potentially null/undefined values
function safeGetText(obj, path) {
  try {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return '';
      current = current[part];
    }
    return typeof current === 'string' ? current : '';
  } catch (e) {
    return '';
  }
}

// Extract common themes and patterns from video analyses
function analyzePatterns(videoAnalyses) {
  // Ensure we have valid analyses
  if (!Array.isArray(videoAnalyses) || videoAnalyses.length === 0) {
    return "No videos analyzed.";
  }
  
  const sanitizedAnalyses = videoAnalyses.map(analysis => {
    if (!analysis) return { title: 'Unknown video', description: '' };
    
    // Extract important parts from analysis
    return {
      title: safeGetText(analysis, 'title') || 'Unknown video',
      description: safeGetText(analysis, 'description') || 
                   safeGetText(analysis, 'analysis_result.description') || '',
      transcript: safeGetText(analysis, 'transcript') || 
                  safeGetText(analysis, 'analysis_result.transcript') || '',
      searchQuery: safeGetText(analysis, 'search_query') || 'general content'
    };
  });
  
  // Extract search queries
  const queries = sanitizedAnalyses
    .map(a => a.searchQuery)
    .filter(Boolean)
    .filter((q, i, arr) => arr.indexOf(q) === i); // unique values
  
  // Get video titles for reference
  const titles = sanitizedAnalyses
    .map(a => a.title)
    .filter(Boolean)
    .slice(0, 5);
  
  // Extract common words and phrases from transcripts and descriptions
  const allText = sanitizedAnalyses
    .map(a => `${a.description} ${a.transcript}`)
    .join(' ')
    .toLowerCase();
  
  // Generate comprehensive analysis
  return generatePatternAnalysis(sanitizedAnalyses, queries, titles, allText);
}

// Generate comprehensive pattern analysis
function generatePatternAnalysis(analyses, queries, titles, allText) {
  const numVideos = analyses.length;
  const mainTopic = queries[0] || 'your industry';
  
  // Extract keywords from text
  const keywords = extractKeywords(allText);
  
  // Detect content themes
  const contentThemes = detectContentThemes(analyses);
  
  // Create analysis
  return `
1. CONTENT OVERVIEW
Based on analysis of ${numVideos} videos including: ${titles.join(', ')}
These videos are related to ${mainTopic} and share these common elements:
- Key visual elements: ${contentThemes.visualElements}
- Content structure: ${contentThemes.structure}
- Engagement techniques: ${contentThemes.engagementTechniques}
- Target audience: ${mainTopic} professionals and enthusiasts
- Emotional triggers: ${contentThemes.emotionalTriggers}

2. TECHNICAL REQUIREMENTS
- Camera setup: ${contentThemes.cameraSetup}
- Lighting setup: ${contentThemes.lighting}
- Essential equipment: ${contentThemes.equipment}
- Software: ${contentThemes.software}

3. RECREATION GUIDE
- Pre-production: Plan your key message in advance, limit to 1-2 main points
- Camera angle: ${contentThemes.cameraAngle}
- Performance tips: ${contentThemes.performanceTips}
- Editing workflow: ${contentThemes.editingWorkflow}

4. OPTIMIZATION TIPS
- Posting strategy: 2-3 times per week at peak hours for your audience
- Hashtag recommendations: #${mainTopic.replace(/\s+/g, '')} #Tips #Tutorial ${keywords.map(k => '#' + k.replace(/\s+/g, '')).join(' ')}
- Title format: Include clear benefit in title (e.g., "How to..." or "5 ways to...")
- Engagement strategy: Ask questions in your captions to encourage comments

Focus on consistency and providing immediate value to your viewers. The most successful videos in your niche offer practical tips that can be implemented right away.
`;
}

// Extract relevant keywords from text
function extractKeywords(text) {
  // Remove common words and punctuation
  const cleanText = text.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '').toLowerCase();
  
  // Split into words
  const words = cleanText.split(/\s+/);
  
  // Count word frequency
  const wordCounts = {};
  words.forEach(word => {
    // Skip common words and short words
    if (word.length < 4 || ['this', 'that', 'with', 'from', 'have', 'what', 'when', 'where', 'your', 'been', 'were', 'they', 'their'].includes(word)) {
      return;
    }
    wordCounts[word] = (wordCounts[word] || 0) + 1;
  });
  
  // Sort by frequency
  const sortedWords = Object.entries(wordCounts)
    .filter(([_, count]) => count > 1) // Only words that appear more than once
    .sort(([_a, countA], [_b, countB]) => countB - countA)
    .map(([word]) => word);
  
  // Return top 5 keywords
  return sortedWords.slice(0, 5);
}

// Detect common themes in content
function detectContentThemes(analyses) {
  // Default values based on common patterns in professional content
  const defaults = {
    visualElements: "Professional presentation, clear demonstration of techniques",
    structure: "Short-form educational content with direct value proposition",
    engagementTechniques: "Expert tips, problem-solution format",
    emotionalTriggers: "Desire for professional knowledge and skill improvement",
    cameraSetup: "Stable, front-facing camera with good lighting",
    lighting: "Natural or soft artificial lighting to clearly show details",
    equipment: "Smartphone with good camera or DSLR/mirrorless camera, tripod",
    software: "Basic video editing app for trimming and adding text overlays",
    cameraAngle: "Position at eye level or slightly above for best engagement",
    performanceTips: "Speak clearly, maintain energy, use confident hand gestures",
    editingWorkflow: "Keep videos short (15-60 seconds), add text overlays for key points"
  };
  
  // Analyze descriptions to enhance default values
  const allDescriptions = analyses
    .map(a => a.description)
    .filter(Boolean)
    .join(' ');
  
  // We could implement more sophisticated analysis here, but for now return defaults
  // enhanced with any specific patterns we detect
  
  const result = { ...defaults };
  
  // Check for specific content types
  if (allDescriptions.toLowerCase().includes('tutorial')) {
    result.structure = "Step-by-step tutorial format with clear instructions";
    result.engagementTechniques = "Detailed demonstrations, before/after results";
  }
  
  if (allDescriptions.toLowerCase().includes('tip')) {
    result.structure = "Quick tips format with immediate actionable advice";
    result.engagementTechniques = "Rapid delivery of high-value information";
  }
  
  return result;
}

module.exports = async (req, res) => {
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { videoAnalyses, userId } = req.body;

    if (!Array.isArray(videoAnalyses) || videoAnalyses.length === 0) {
      return res.status(400).json({ error: 'Please provide at least one video analysis' });
    }

    console.log(`Analyzing patterns for ${videoAnalyses.length} video(s)`);
    
    // Generate pattern analysis without relying on external AI API
    const patternAnalysis = analyzePatterns(videoAnalyses);
    
    // Extract search queries for storage
    const searchQueries = videoAnalyses
      .map(v => (v && v.search_query) ? v.search_query : null)
      .filter(Boolean);
    
    // Ensure we have at least one search query
    if (searchQueries.length === 0) {
      searchQueries.push('general content');
    }

    // Store the analysis in Supabase
    const { error: dbError } = await supabase
      .from('pattern_analyses')
      .insert({
        user_id: userId,
        num_videos_analyzed: videoAnalyses.length,
        video_analyses: videoAnalyses,
        pattern_analysis: patternAnalysis,
        search_queries: searchQueries,
        status: 'completed',
        created_at: new Date().toISOString()
      });

    if (dbError) {
      console.error('Error storing pattern analysis:', dbError);
      return res.status(500).json({
        success: false,
        error: `Database error: ${dbError.message}`
      });
    }

    return res.status(200).json({ 
      success: true, 
      result: {
        pattern_analysis: patternAnalysis,
        analyzed_videos: videoAnalyses.length
      }
    });
  } catch (error) {
    console.error('Error in pattern analysis:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'An unexpected error occurred',
      details: error.stack
    });
  }
}; 