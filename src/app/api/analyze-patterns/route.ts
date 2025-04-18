import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: Request) {
  try {
    const { videoAnalyses, userId } = await request.json()

    if (!Array.isArray(videoAnalyses) || videoAnalyses.length === 0) {
      throw new Error('Please provide at least one video analysis')
    }

    console.log(`Analyzing patterns for ${videoAnalyses.length} video(s)`)

    if (!process.env.TOGETHER_API_KEY) {
      throw new Error('Together API key is not configured')
    }

    // Simplified prompt for a single video analysis
    const prompt = `You are an expert social media content analyst. Your task is to analyze this video and provide actionable recommendations for recreating similar successful content.

${videoAnalyses.map((analysis, index) => `
VIDEO ANALYSIS:
${JSON.stringify(analysis, null, 2)}`)[0]}

Based on this analysis, provide a comprehensive breakdown in the following format:

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

Focus on actionable, specific recommendations that can be immediately implemented. Keep your analysis concise and practical.`

    let patternAnalysis = "";
    try {
      // Send to Together AI for analysis
      const response = await fetch('https://api.together.xyz/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free',
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
          max_tokens: 2000,
          top_p: 0.9,
          frequency_penalty: 0.3,
          presence_penalty: 0.3
        })
      })

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Together AI API error: ${response.status}`, errorText);
        
        patternAnalysis = `Error from Together AI service: ${response.status}. Using available video analysis without AI processing.
        
${JSON.stringify(videoAnalyses[0], null, 2)}`;
      } else {
        const result = await response.json();
        if (result.choices && result.choices[0] && result.choices[0].message) {
          patternAnalysis = result.choices[0].message.content;
        } else {
          console.error('Unexpected API response format:', JSON.stringify(result, null, 2));
          patternAnalysis = `Unable to generate analysis due to API response format issues. Raw video analysis included:
          
${JSON.stringify(videoAnalyses[0], null, 2)}`;
        }
      }
    } catch (apiError) {
      console.error('Error calling Together AI API:', apiError);
      patternAnalysis = `Error generating analysis: ${apiError instanceof Error ? apiError.message : String(apiError)}. Using available video analysis without AI processing.
      
${JSON.stringify(videoAnalyses[0], null, 2)}`;
    }

    // Make sure userId is defined before saving to the database
    if (!userId) {
      console.error('No userId provided for analysis');
      return NextResponse.json({
        success: false,
        error: 'No userId provided for analysis'
      }, { status: 400 });
    }
    
    // Store the analysis in Supabase
    const { error: dbError } = await supabase
      .from('pattern_analyses')
      .insert({
        user_id: userId,
        num_videos_analyzed: videoAnalyses.length,
        video_analyses: videoAnalyses,
        pattern_analysis: patternAnalysis,
        search_queries: videoAnalyses.map(v => v.search_query || 'unknown').filter(Boolean),
        status: 'completed',
        created_at: new Date().toISOString()
      })

    if (dbError) {
      console.error('Error storing analysis:', dbError)
    }

    return NextResponse.json({ 
      success: true, 
      result: {
        pattern_analysis: patternAnalysis,
        analyzed_videos: videoAnalyses.length
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