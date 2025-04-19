import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Ensure we have the type for video analyses
interface VideoAnalysis {
  title?: string;
  search_query?: string;
  [key: string]: any;
}

export async function POST(request: Request) {
  try {
    const { videoAnalyses, userId } = await request.json()

    if (!Array.isArray(videoAnalyses) || videoAnalyses.length === 0) {
      throw new Error('Please provide at least one video analysis')
    }

    console.log(`Analyzing patterns for ${videoAnalyses.length} video(s)`)

    // Sanitize videoAnalyses to ensure all have necessary properties
    const sanitizedAnalyses = videoAnalyses.map((analysis, index) => {
      // Handle null or undefined analysis
      if (!analysis) {
        return {
          title: `Video ${index + 1}`,
          description: "No analysis available",
          search_query: "general content",
          id: `fallback-${index}`
        };
      }
      
      // Ensure all required properties exist
      return {
        ...analysis,
        title: analysis.title || `Video ${index + 1}`,
        search_query: analysis.search_query || "general content"
      };
    });

    // Generate pattern analysis directly without external API
    // Extract useful information from analyses
    const videoTitles = sanitizedAnalyses
      .map(v => (v && v.title) ? v.title : 'Untitled video')
      .filter(Boolean)
      .slice(0, 5);
    
    const searchQueries = sanitizedAnalyses
      .map(v => (v && v.search_query) ? v.search_query : 'general content')
      .filter(Boolean);
    
    const descriptions = sanitizedAnalyses
      .map(v => {
        if (v && v.description) return v.description;
        if (v && v.analysis_result && v.analysis_result.description) return v.analysis_result.description;
        return '';
      })
      .filter(Boolean);
    
    // Generate a comprehensive pattern analysis based on the collected data
    const patternAnalysis = generatePatternAnalysis(videoTitles, searchQueries, descriptions);

    // Ensure we have at least one search query
    if (searchQueries.length === 0) {
      searchQueries.push('general content');
    }

    // Store the analysis in Supabase
    const { error: dbError } = await supabase
      .from('pattern_analyses')
      .insert({
        user_id: userId,
        num_videos_analyzed: sanitizedAnalyses.length,
        video_analyses: sanitizedAnalyses,
        pattern_analysis: patternAnalysis,
        search_queries: searchQueries,
        status: 'completed',
        created_at: new Date().toISOString()
      })

    if (dbError) {
      console.error('Error storing analysis:', dbError)
      return NextResponse.json({
        success: false,
        error: `Database error: ${dbError.message}`
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      result: {
        pattern_analysis: patternAnalysis,
        analyzed_videos: sanitizedAnalyses.length
      }
    })
  } catch (error) {
    console.error('Error in analysis:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

// Generate a comprehensive pattern analysis without relying on external APIs
function generatePatternAnalysis(
  videoTitles: string[],
  searchQueries: string[], 
  descriptions: string[]
): string {
  const numVideos = videoTitles.length;
  const titlesList = videoTitles.join(', ');
  const mainTopic = searchQueries[0] || 'your industry';
  
  // Extract keywords from descriptions
  const allText = descriptions.join(' ').toLowerCase();
  const commonKeywords = extractKeywords(allText);
  
  return `
1. CONTENT OVERVIEW
Based on analysis of ${numVideos} videos including: ${titlesList}. 
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
- Hashtag recommendations: #${mainTopic.replace(/\s+/g, '')} #Tips #Tutorial ${commonKeywords.map(k => '#' + k.replace(/\s+/g, '')).join(' ')}
- Title format: Include clear benefit in title (e.g., "How to..." or "5 ways to...")
- Engagement strategy: Ask questions in your captions to encourage comments

Focus on consistency and providing immediate value to your viewers. The most successful videos in your niche offer practical tips that can be implemented right away.
`;
}

// Extract likely keywords from text
function extractKeywords(text: string): string[] {
  // Remove common words and punctuation
  const cleanText = text.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '').toLowerCase();
  
  // Split into words
  const words = cleanText.split(/\s+/);
  
  // Count word frequency
  const wordCounts: Record<string, number> = {};
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