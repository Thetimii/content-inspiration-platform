import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

// Make sure we have a valid Stripe secret key
if (!process.env.STRIPE_SECRET_KEY) {
  console.error('Missing STRIPE_SECRET_KEY environment variable');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

// Function to create a product and price if needed
async function createProductAndPrice() {
  try {
    // Create a product
    const product = await stripe.products.create({
      name: 'Lazy Trends Pro Plan',
      description: 'AI-powered TikTok trend recommendations',
    });

    // Create a price for the product
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: 3995, // $39.95 in cents
      currency: 'usd',
      recurring: {
        interval: 'month',
      },
    });

    console.log('Created new product and price:', price.id);
    return price.id;
  } catch (error) {
    console.error('Error creating product and price:', error);
    throw error;
  }
}

// Hardcoded price ID for the $39.95/month subscription
// This should be replaced with your actual price ID from Stripe
const PRICE_ID = 'price_1RH6CRG4vQYDStWYJIIk27cL';

export async function POST(req: Request) {
  try {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    // Get the user from the session
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'You must be logged in to create a checkout session' },
        { status: 401 }
      );
    }

    // Get or create a valid price ID
    let priceId;
    try {
      // Try to use the price ID from the request
      const { data } = await req.json();
      priceId = data.price_id;

      // Validate the price ID format
      if (!priceId || !priceId.startsWith('price_')) {
        console.log('Invalid price ID format, using hardcoded price ID');
        priceId = PRICE_ID;
      }
    } catch (error) {
      console.log('Error parsing request body, using hardcoded price ID');
      priceId = PRICE_ID;
    }

    // If we're still using the hardcoded price ID, verify it exists or create a new one
    if (priceId === PRICE_ID) {
      try {
        // Try to retrieve the price to verify it exists
        await stripe.prices.retrieve(priceId);
      } catch (error) {
        console.log('Price ID not found, creating new product and price');
        priceId = await createProductAndPrice();
      }
    }

    // Create Checkout Sessions from body params.
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          // Provide the exact Price ID of the product you want to sell
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.lazy-trends.com'}/dashboard?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.lazy-trends.com'}/landing?canceled=true`,
      customer_email: user.email,
      metadata: {
        userId: user.id,
      },
      subscription_data: {
        trial_period_days: 7, // 7-day free trial
      },
    });

    return NextResponse.json({ sessionId: session.id });
  } catch (err: any) {
    console.error('Error creating checkout session:', err);
    return NextResponse.json(
      { error: { message: err.message || 'An error occurred during checkout' } },
      { status: 500 }
    );
  }
}
