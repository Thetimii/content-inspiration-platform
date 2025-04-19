const { OpenAI } = require('openai');
const { createClient } = require('@supabase/supabase-js');

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY
});

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userInput, userId, count = 5 } = req.body;

  if (!userInput) {
    return res.status(400).json({ error: 'User input is required' });
  }

  try {
    console.log(`Generating search queries based on: "${userInput}"`);
    
    // Generate search queries using OpenAI
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are an expert in social media trends and content discovery. Your task is to generate search queries that would lead to engaging and relevant short-form video content.'
        },
        {
          role: 'user',
          content: `Based on this topic or interest: "${userInput}", generate ${count} search queries that would return engaging TikTok videos. 
          These should be phrases or hashtags people would actually use on TikTok. 
          Format the response as a JSON array of strings with no additional explanation.`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7
    });

    // Parse the response
    let searchQueries = [];
    try {
      const content = response.choices[0].message.content;
      const parsedContent = JSON.parse(content);
      searchQueries = parsedContent.queries || [];
      
      if (!Array.isArray(searchQueries)) {
        throw new Error('Expected an array of search queries');
      }
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      return res.status(500).json({ error: 'Failed to parse search queries' });
    }

    console.log(`Generated ${searchQueries.length} search queries`);

    // Store queries in database if userId is provided
    if (userId) {
      try {
        const { error } = await supabase
          .from('search_queries')
          .insert({
            user_id: userId,
            input: userInput,
            queries: searchQueries,
            created_at: new Date().toISOString()
          });
        
        if (error) {
          console.error('Database error:', error);
        } else {
          console.log('Search queries stored successfully');
        }
      } catch (dbError) {
        console.error('Error storing in database:', dbError);
      }
    }

    return res.status(200).json({
      success: true,
      queries: searchQueries
    });
  } catch (error) {
    console.error('Error generating search queries:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate search queries'
    });
  }
}; 