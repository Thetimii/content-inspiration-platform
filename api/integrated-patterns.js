const { createClient } = require('@supabase/supabase-js');
const { OpenAI } = require('openai');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY
});

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
    
    // Sanitize the input data
    const sanitizedAnalyses = videoAnalyses.map(analysis => {
      if (!analysis) return { title: 'Unknown video' };
      
      // Handle different data structures
      const title = analysis.title || 
                   (analysis.analysis_result && analysis.analysis_result.metadata && analysis.analysis_result.metadata.title) || 
                   'Unknown video';
                   
      const transcript = (analysis.analysis_result && analysis.analysis_result.transcript) || 
                        analysis.transcript || 
                        '';
                        
      const description = (analysis.analysis_result && analysis.analysis_result.description) || 
                         analysis.description || 
                         '';
                         
      const searchQuery = analysis.search_query || 'general content';
      
      return {
        title,
        transcript,
        description,
        searchQuery
      };
    });
    
    // Extract common topics and themes
    const allTranscripts = sanitizedAnalyses.map(a => a.transcript).filter(Boolean).join(' ');
    const allDescriptions = sanitizedAnalyses.map(a => a.description).filter(Boolean).join(' ');
    const searchQueries = sanitizedAnalyses.map(a => a.searchQuery).filter(Boolean);
    const titles = sanitizedAnalyses.map(a => a.title).filter(Boolean);
    
    // Generate pattern analysis using OpenAI
    const patternAnalysis = await generatePatternAnalysis(
      titles,
      searchQueries,
      allTranscripts,
      allDescriptions
    );
    
    // Store in Supabase
    if (userId) {
      try {
        // Ensure we have at least one search query
        const uniqueQueries = [...new Set(searchQueries)];
        const queriesForDB = uniqueQueries.length > 0 ? uniqueQueries : ['general content'];
        
        const { error } = await supabase
          .from('pattern_analyses')
          .insert({
            user_id: userId,
            num_videos_analyzed: videoAnalyses.length,
            video_analyses: videoAnalyses,
            pattern_analysis: patternAnalysis,
            search_queries: queriesForDB,
            status: 'completed',
            created_at: new Date().toISOString()
          });
          
        if (error) {
          console.error('Error storing pattern analysis:', error);
        } else {
          console.log('Pattern analysis stored successfully');
        }
      } catch (dbError) {
        console.error('Database error:', dbError);
      }
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

// Generate comprehensive pattern analysis using GPT-4
async function generatePatternAnalysis(titles, searchQueries, transcripts, descriptions) {
  try {
    // Prevent empty inputs
    const safeSearchQuery = searchQueries.length > 0 ? searchQueries[0] : 'general content';
    const safeTitles = titles.length > 0 ? titles.join(', ') : 'Unknown videos';
    
    // Use OpenAI to generate pattern analysis
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an expert social media content analyst specializing in identifying patterns and providing actionable recommendations for content creation.'
        },
        {
          role: 'user',
          content: `
          Analyze these ${titles.length} videos about "${safeSearchQuery}" and provide comprehensive patterns and recommendations.

          VIDEO TITLES:
          ${safeTitles}

          SEARCH QUERIES:
          ${searchQueries.join(', ') || safeSearchQuery}

          TRANSCRIPTS SUMMARY:
          ${transcripts.slice(0, 1500) + (transcripts.length > 1500 ? '...' : '')}

          DESCRIPTIONS SUMMARY:
          ${descriptions.slice(0, 1500) + (descriptions.length > 1500 ? '...' : '')}

          Format your response in the following structure:
          
          1. CONTENT OVERVIEW
          - Key visual elements and compositions used
          - Content structure and narrative flow
          - Engagement techniques identified
          - Target audience characteristics
          - Emotional triggers and hooks

          2. TECHNICAL REQUIREMENTS
          - Camera setup and movements
          - Lighting setup and techniques
          - Essential equipment list with alternatives
          - Software and editing tools needed

          3. RECREATION GUIDE
          - Pre-production planning steps
          - Camera angle and lighting recommendations
          - Performance/presentation tips
          - Editing workflow and effects

          4. OPTIMIZATION TIPS
          - Ideal posting strategy
          - Hashtag recommendations
          - Title and description format
          - Engagement strategies

          Provide specific, actionable advice that could be implemented immediately. Be concise but thorough.
          `
        }
      ],
      temperature: 0.7,
      max_tokens: 1500
    });
    
    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error generating pattern analysis with OpenAI:', error);
    
    // Fallback to basic pattern analysis if OpenAI fails
    return createBasicPatternAnalysis(titles, searchQueries);
  }
}

// Create a basic pattern analysis without API
function createBasicPatternAnalysis(titles, searchQueries) {
  const mainTopic = searchQueries.length > 0 ? searchQueries[0] : 'your industry';
  const titlesList = titles.length > 0 ? titles.join(', ') : 'the analyzed videos';
  
  return `
1. CONTENT OVERVIEW
Based on analysis of videos including: ${titlesList}
These videos are related to ${mainTopic} and share these common elements:
- Key visual elements: Professional presentation, clear demonstration of techniques
- Content structure: Short-form educational content with direct value proposition
- Engagement techniques: Expert tips, problem-solution format
- Target audience: ${mainTopic} professionals and enthusiasts
- Emotional triggers: Desire for professional knowledge and skill improvement

2. TECHNICAL REQUIREMENTS
- Camera setup: Stable, front-facing camera with good lighting
- Lighting setup: Natural or soft artificial lighting to clearly show details
- Essential equipment: Smartphone with good camera or DSLR/mirrorless camera, tripod
- Software: Basic video editing app for trimming and adding text overlays

3. RECREATION GUIDE
- Pre-production: Plan your key message in advance, limit to 1-2 main points
- Camera angle: Position at eye level or slightly above for best engagement
- Performance tips: Speak clearly, maintain energy, use confident hand gestures
- Editing workflow: Keep videos short (15-60 seconds), add text overlays for key points

4. OPTIMIZATION TIPS
- Posting strategy: 2-3 times per week at peak hours for your audience
- Hashtag recommendations: #${mainTopic.replace(/\s+/g, '')} #Tips #Tutorial
- Title format: Include clear benefit in title (e.g., "How to..." or "5 ways to...")
- Engagement strategy: Ask questions in your captions to encourage comments

Focus on consistency and providing immediate value to your viewers. The most successful videos in your niche offer practical tips that can be implemented right away.
`;
} 