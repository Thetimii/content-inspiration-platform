import { BusinessContext } from '@/types/analysis';

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export async function generateSearchQueries(businessContext: BusinessContext): Promise<string[]> {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_OPENROUTER_API_KEY}`,
        'HTTP-Referer': '*',
      },
      body: JSON.stringify({
        model: 'qwen/qwq-32b:free',
        messages: [
          {
            role: 'system',
            content: 'You are a TikTok trend expert who generates viral search queries that people use to find interesting content about specific topics. Focus on what viewers search for, not business promotion.'
          },
          {
            role: 'user',
            content: `Generate 5 trending TikTok search queries about "${businessContext.business_type}" content.

Rules:
- Must be actual TikTok-style search terms people use
- Focus on content people want to watch (recipes, tips, behind-the-scenes, etc.)
- Maximum 3 words per query
- No hashtags or special characters
- One query per line
- No explanations

Example for "pizza bakery":
pizza dough stretch
secret bread recipe
morning bakery routine
pizza toss tutorial
croissant layers`
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(`OpenRouter API error: ${response.status}${errorData ? ' - ' + JSON.stringify(errorData) : ''}`);
    }

    const data: OpenRouterResponse = await response.json();
    
    // Split the response into lines and take only the first 5 lines
    const queries = data.choices[0].message.content
      .split('\n')
      .filter(line => line.trim())
      .slice(0, 5);

    return queries;
  } catch (error) {
    console.error('Error generating search queries:', error);
    throw error;
  }
} 