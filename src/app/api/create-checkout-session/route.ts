import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import Stripe from 'stripe';

export async function POST(req: Request) {
  console.log('Starting create-checkout-session handler');
  
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
        { error: 'You must be logged in to create a checkout session' },
        { status: 401 }
      );
    }
    
    console.log('Authenticated user:', user.id);

    // Get the price ID from environment variables
    const priceId = process.env.STRIPE_PRICE_ID;
    
    if (!priceId) {
      console.error('Missing STRIPE_PRICE_ID environment variable');
      return NextResponse.json(
        { error: 'Price ID is missing. Please contact support.' },
        { status: 500 }
      );
    }
    
    console.log('Using price ID:', priceId);

    // Create a simple checkout session with minimal options
    console.log('Creating checkout session...');
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.lazy-trends.com'}/dashboard?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.lazy-trends.com'}/checkout?canceled=true`,
      customer_email: user.email,
    });

    console.log('Checkout session created:', session.id);
    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('Error creating checkout session:', err);
    return NextResponse.json(
      { error: err.message || 'An error occurred during checkout' },
      { status: 500 }
    );
  }
}
