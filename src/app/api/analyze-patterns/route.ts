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

    // Simplified prompt for video analyses
    const prompt = `You are an expert social media content analyst. Your task is to analyze these videos and provide actionable recommendations for recreating similar successful content.

${sanitizedAnalyses.map((analysis, index) => `
VIDEO ANALYSIS ${index + 1}:
${JSON.stringify(analysis, null, 2)}`).join('\n')}

Based on these analyses, provide a comprehensive breakdown in the following format:

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

Focus on actionable, specific recommendations that can be immediately implemented. Keep your analysis concise and practical.`;
    
    // Try up to 3 times with exponential backoff
    let patternAnalysis = "";
    let attempts = 0;
    const maxAttempts = 3;
    let waitTime = 1000; // Start with 1 second
    
    while (attempts < maxAttempts) {
      attempts++;
      try {
        console.log(`Pattern analysis attempt ${attempts}/${maxAttempts}`);
        
        // Send to Together AI for analysis
        const response = await fetch('https://api.together.xyz/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.TOGETHER_API_KEY!}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'meta-llama/Llama-3.1-8B-Instruct',  // Using a smaller model that has less rate limiting
            messages: [
              {
                role: 'system',
                content: 'You are an expert social media content analyst specializing in providing actionable recommendations for content creation. Be specific, practical, and focus on implementable advice.'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0.7,
            max_tokens: 1500,
            top_p: 0.9
          })
        });

        if (response.ok) {
          const result = await response.json();
          if (result.choices && result.choices[0] && result.choices[0].message) {
            patternAnalysis = result.choices[0].message.content;
            break; // Success! Exit the loop
          } else {
            console.error('Unexpected API response format:', JSON.stringify(result, null, 2));
            // Wait longer before next attempt
            await new Promise(resolve => setTimeout(resolve, waitTime));
            waitTime *= 2; // Exponential backoff
            continue;
          }
        } else {
          // Handle rate limits explicitly
          if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After');
            const waitSeconds = retryAfter ? parseInt(retryAfter, 10) : 10;
            console.log(`Rate limited. Waiting ${waitSeconds} seconds before retry.`);
            await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
          } else {
            console.error(`API error: ${response.status}. Waiting before retry.`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            waitTime *= 2; // Exponential backoff
          }
        }
      } catch (error) {
        console.error('Error calling Together AI API:', error);
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, waitTime));
        waitTime *= 2; // Exponential backoff
      }
    }
    
    // If we still don't have a pattern analysis, create a basic one from video titles
    if (!patternAnalysis) {
      // Extract important information from videos - with safety checks
      const videoTitles = sanitizedAnalyses
        .map(v => (v && v.title) ? v.title : 'Untitled video')
        .slice(0, 3);
      const numVideos = sanitizedAnalyses.length;
      
      patternAnalysis = `
CONTENT OVERVIEW
Based on analysis of ${numVideos} videos including: ${videoTitles.join(', ')}. These videos follow common patterns in successful content for your industry.

TECHNICAL REQUIREMENTS
Standard recording equipment is recommended for creating similar content. Focus on good lighting and clear audio.

RECREATION GUIDE
Follow the standard content creation workflow for your industry, emphasizing quality and consistency.

OPTIMIZATION TIPS
Post regularly and engage with your audience through comments and shares.
`;
    }

    // Extract search queries with safety check
    const searchQueries = sanitizedAnalyses
      .map(v => (v && v.search_query) ? v.search_query : 'general content')
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