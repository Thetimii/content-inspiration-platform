import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';

/**
 * API endpoint to process a single query
 * This is called by process-queries to chain processing and avoid timeouts
 */
export async function POST(request: Request) {
  try {
    const { userId, queries, currentIndex } = await request.json();

    if (!userId || !queries || !Array.isArray(queries) || currentIndex === undefined) {
      return NextResponse.json(
        { error: 'User ID, queries array, and currentIndex are required' },
        { status: 400 }
      );
    }

    if (currentIndex < 0 || currentIndex >= queries.length) {
      return NextResponse.json(
        { error: 'Invalid currentIndex' },
        { status: 400 }
      );
    }

    console.log(`Processing single query ${currentIndex + 1}/${queries.length} for user ${userId}`);

    // Import the processQueryAndChain function from process-queries
    const { processQueryAndChain } = await import('../process-queries/route');

    // Start processing this query in the background
    // We don't await this to avoid timeouts
    processQueryAndChain(queries, currentIndex, userId).catch(error => {
      console.error('Error in background processing:', error);
    });

    // Return immediately with a success response
    return NextResponse.json({
      success: true,
      message: `Started processing query ${currentIndex + 1}/${queries.length} for user ${userId}. Results will be saved automatically.`,
      status: 'processing'
    });
  } catch (error: any) {
    console.error('Error in process-single-query API route:', error);

    return NextResponse.json(
      {
        error: error.message || 'An error occurred during query processing',
        suggestion: 'Please try again later or contact support if the issue persists.'
      },
      { status: 500 }
    );
  }
}
