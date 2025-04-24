import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import Stripe from 'stripe';

export async function POST(req: Request) {
  console.log('Starting create-portal-session handler');
  
  try {
    // Initialize Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2023-10-16',
    });
    
    // Get the user from the session
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.log('No authenticated user found');
      return NextResponse.json(
        { error: 'You must be logged in to access the customer portal' },
        { status: 401 }
      );
    }
    
    console.log('Authenticated user:', user.id);

    // Get the customer ID from the database
    const { data: userData } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    if (!userData?.stripe_customer_id) {
      console.log('No Stripe customer ID found for user:', user.id);
      return NextResponse.json(
        { error: 'No subscription found for this user' },
        { status: 404 }
      );
    }
    
    console.log('Creating portal session for customer:', userData.stripe_customer_id);

    // Create a portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: userData.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.lazy-trends.com'}/dashboard`,
    });

    console.log('Portal session created:', session.id);
    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('Error creating portal session:', err);
    return NextResponse.json(
      { error: err.message || 'An error occurred creating the portal session' },
      { status: 500 }
    );
  }
}
