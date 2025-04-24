import { NextResponse } from 'next/server';
import axios from 'axios';
import { supabase } from '@/utils/supabase';

/**
 * A super simplified endpoint that ONLY generates trending queries
 * This helps avoid timeouts by doing minimal work in a single request
 */
export async function POST(request: Request) {
  try {
    const { businessDescription, userId } = await request.json();

    if (!businessDescription || !userId) {
      return NextResponse.json(
        { error: 'Business description and user ID are required' },
        { status: 400 }
      );
    }

    console.log('Generating trending queries for:', businessDescription);

    // Check if API key is available
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error('OpenRouter API key is missing');
      return NextResponse.json(
        { error: 'OpenRouter API key is missing. Please add it to your environment variables.' },
        { status: 500 }
      );
    }

    // Sanitize the API key - remove any whitespace or invalid characters
    const sanitizedApiKey = apiKey.trim();

    // Make the API call to OpenRouter
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'google/gemma-3-4b-it:free',
        messages: [
          {
            role: 'system',
            content: 'You are a TikTok trend expert. Respond with EXACTLY 5 trending search terms related to the business. ONLY provide the 5 keywords/phrases, one per line, numbered 1-5. NO explanations, NO descriptions, NO additional text. ONLY the 5 search terms. Example format:\n1. keyword1\n2. keyword2\n3. keyword3\n4. keyword4\n5. keyword5'
          },
          {
            role: 'user',
            content: businessDescription
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${sanitizedApiKey}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://lazy-trends.vercel.app',
          'X-Title': 'Lazy Trends',
          'Content-Type': 'application/json'
        }
      }
    );

    // Extract and parse the search queries from the response
    const content = response.data?.choices?.[0]?.message?.content || '';
    console.log('OpenRouter API response content:', content);

    // Split by newlines and extract only the keywords
    const queries = content
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line && /^\d+\./.test(line)) // Only keep numbered lines
      .map((line: string) => line.replace(/^\d+\.\s*/, '').trim()) // Remove numbering and trim
      .filter(Boolean)
      .map((keyword: string) => keyword.replace(/["']/g, '')) // Remove any quotes
      .map((keyword: string) => keyword.replace(/^#/, '')); // Remove leading hashtag if present

    // Verify we have exactly 5 queries
    if (!queries || queries.length !== 5) {
      console.error(`Expected exactly 5 queries, but got ${queries?.length || 0}`);
      return NextResponse.json(
        { error: 'Failed to generate exactly 5 trending queries. Please try again.' },
        { status: 500 }
      );
    }

    console.log('Successfully generated 5 trending queries:', queries);

    // Save queries to database
    const savedQueries: any[] = [];

    // Process all queries
    for (const query of queries) {
      // Save query to database
      const { data, error } = await supabase
        .from('trend_queries')
        .insert({
          user_id: userId,
          query,
        })
        .select();

      if (error) {
        console.error('Error saving query:', error);
      } else if (data && data[0]) {
        savedQueries.push(data[0]);
      }
    }

    // Trigger the next step in a separate request
    if (savedQueries.length > 0) {
      try {
        // Use a direct API call to trigger the next step
        const queryIds = savedQueries.map(q => q.id);
        console.log('Directly calling process-queries with query IDs:', queryIds);

        // Make a direct call to the process-queries endpoint
        // Make sure we have the correct base URL
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        console.log(`Using base URL for process-queries: ${baseUrl}`);

        const processResponse = await fetch(`${baseUrl}/api/process-queries`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            queryIds
          })
        });

        console.log(`Process-queries response status: ${processResponse.status}`);

        if (!processResponse.ok) {
          const errorText = await processResponse.text();
          console.error(`Error from process-queries (status ${processResponse.status}):`, errorText);

          // Try to parse as JSON if possible
          try {
            const errorData = JSON.parse(errorText);
            console.error('Parsed error data:', errorData);
          } catch (e) {
            // Not JSON, that's fine
          }
        } else {
          const processData = await processResponse.json();
          console.log('Process-queries response:', processData);
        }
      } catch (e) {
        console.error('Failed to trigger process-queries:', e);
      }
    }

    // Return the saved queries immediately
    return NextResponse.json({
      queries: savedQueries
    });
  } catch (error: any) {
    console.error('Error in simple-trending API route:', error);

    return NextResponse.json(
      {
        error: error.message || 'An error occurred',
        suggestion: 'Please try again later or contact support if the issue persists.'
      },
      { status: 500 }
    );
  }
}
