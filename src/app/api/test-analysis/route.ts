import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';

/**
 * Test endpoint to trigger video analysis on existing videos
 * This allows us to test the analysis functionality without registering a new user
 */
export async function GET(request: Request) {
  try {
    console.log('Starting test analysis...');

    // Get the first user from the database
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, business_description')
      .limit(1);

    if (userError || !users || users.length === 0) {
      console.error('Error fetching users:', userError);
      return NextResponse.json(
        { error: 'No users found in the database' },
        { status: 404 }
      );
    }

    const user = users[0];
    console.log(`Found user: ${user.id}`);

    // Get existing videos for this user
    const { data: queries, error: queryError } = await supabase
      .from('trend_queries')
      .select('id')
      .eq('user_id', user.id)
      .limit(5);

    if (queryError || !queries || queries.length === 0) {
      console.error('Error fetching queries:', queryError);
      
      // If no queries exist, create some test queries
      if (!queries || queries.length === 0) {
        console.log('No queries found, creating test queries...');
        
        // Create test queries using the user's business description
        const testQueries = [
          'trending tiktok content',
          'viral social media',
          'tiktok marketing tips',
          'social media growth',
          'content creation ideas'
        ];
        
        const { data: createdQueries, error: createError } = await supabase
          .from('trend_queries')
          .insert(
            testQueries.map(query => ({
              user_id: user.id,
              query
            }))
          )
          .select();
          
        if (createError || !createdQueries || createdQueries.length === 0) {
          console.error('Error creating test queries:', createError);
          return NextResponse.json(
            { error: 'Failed to create test queries' },
            { status: 500 }
          );
        }
        
        console.log(`Created ${createdQueries.length} test queries`);
        
        // Use the newly created queries
        const queryIds = createdQueries.map(q => q.id);
        
        // Call the direct-analysis endpoint to trigger the analysis
        const analysisResponse = await fetch(new URL('/api/direct-analysis', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.id,
            videoIds: [] // No videos yet, we'll need to scrape them first
          }),
        });
        
        if (!analysisResponse.ok) {
          const errorData = await analysisResponse.json();
          console.error('Error from direct-analysis API:', errorData);
          return NextResponse.json(
            { error: 'Failed to trigger analysis' },
            { status: 500 }
          );
        }
        
        return NextResponse.json({
          success: true,
          message: 'Created test queries and triggered analysis',
          user: user.id,
          queries: createdQueries
        });
      }
      
      return NextResponse.json(
        { error: 'No queries found for this user' },
        { status: 404 }
      );
    }

    console.log(`Found ${queries.length} queries for user ${user.id}`);

    // Get videos for these queries
    const queryIds = queries.map(q => q.id);
    const { data: videos, error: videoError } = await supabase
      .from('tiktok_videos')
      .select('id, trend_query_id')
      .in('trend_query_id', queryIds)
      .limit(10);

    if (videoError) {
      console.error('Error fetching videos:', videoError);
      return NextResponse.json(
        { error: 'Error fetching videos' },
        { status: 500 }
      );
    }

    if (!videos || videos.length === 0) {
      console.log('No videos found, triggering video scraping...');
      
      // Call the trending-queries endpoint to scrape videos
      const scrapingResponse = await fetch(new URL('/api/trending-queries', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businessDescription: user.business_description || 'social media content creation',
          userId: user.id
        }),
      });
      
      if (!scrapingResponse.ok) {
        const errorData = await scrapingResponse.json();
        console.error('Error from trending-queries API:', errorData);
        return NextResponse.json(
          { error: 'Failed to scrape videos' },
          { status: 500 }
        );
      }
      
      const scrapingData = await scrapingResponse.json();
      console.log('Trending-queries API response:', scrapingData);
      
      return NextResponse.json({
        success: true,
        message: 'Triggered video scraping and analysis',
        user: user.id,
        queries: scrapingData.queries,
        videos: scrapingData.videos
      });
    }

    console.log(`Found ${videos.length} videos for analysis`);

    // Trigger analysis for these videos
    const videoIds = videos.map(v => v.id);
    
    // Call the direct-analysis endpoint to trigger the analysis
    const analysisResponse = await fetch(new URL('/api/direct-analysis', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: user.id,
        videoIds
      }),
    });
    
    if (!analysisResponse.ok) {
      const errorData = await analysisResponse.json();
      console.error('Error from direct-analysis API:', errorData);
      return NextResponse.json(
        { error: 'Failed to trigger analysis' },
        { status: 500 }
      );
    }
    
    const analysisData = await analysisResponse.json();
    console.log('Direct-analysis API response:', analysisData);

    return NextResponse.json({
      success: true,
      message: 'Analysis triggered for existing videos',
      user: user.id,
      videoCount: videos.length,
      videoIds
    });
  } catch (error: any) {
    console.error('Error in test-analysis API route:', error);

    return NextResponse.json(
      {
        error: error.message || 'An error occurred during test analysis',
        suggestion: 'Please check the server logs for more details'
      },
      { status: 500 }
    );
  }
}
