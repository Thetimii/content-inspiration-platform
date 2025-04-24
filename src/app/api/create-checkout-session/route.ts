import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { getStripeInstance, SUBSCRIPTION_PLAN } from '@/utils/stripe';

export async function POST(req: Request) {
  try {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);
    const stripe = getStripeInstance();

    // Get the user from the session
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'You must be logged in to create a checkout session' },
        { status: 401 }
      );
    }

    // Check if user already has an active subscription
    const { data: userData } = await supabase
      .from('users')
      .select('stripe_customer_id, stripe_subscription_id, subscription_status')
      .eq('id', user.id)
      .single();

    // If user already has an active subscription, redirect to customer portal instead
    if (userData?.subscription_status === 'active' || userData?.subscription_status === 'trialing') {
      // Create a customer portal session for existing subscribers
      if (userData.stripe_customer_id) {
        const portalSession = await stripe.billingPortal.sessions.create({
          customer: userData.stripe_customer_id,
          return_url: `${req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'https://www.lazy-trends.com'}/dashboard`,
        });

        return NextResponse.json({ url: portalSession.url });
      }
    }

    // For new subscriptions, create a checkout session
    let customerId = userData?.stripe_customer_id;

    // If no customer ID exists, create a new customer
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          userId: user.id
        }
      });
      customerId = customer.id;

      // Update user with Stripe customer ID
      await supabase
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
    }

    // Create or get a price for the subscription
    let priceId;
    try {
      // Try to use the price ID from the request
      const { priceId: requestPriceId } = await req.json();
      if (requestPriceId && requestPriceId.startsWith('price_')) {
        priceId = requestPriceId;
      }
    } catch (error) {
      // If no price ID in request, continue with product lookup/creation
    }

    if (!priceId) {
      // Look up existing prices for our product
      const prices = await stripe.prices.list({
        product: SUBSCRIPTION_PLAN.name.toLowerCase().replace(/\s+/g, '-'),
        active: true,
        limit: 1,
      });

      if (prices.data.length > 0) {
        priceId = prices.data[0].id;
      } else {
        // Create a new product and price
        const product = await stripe.products.create({
          name: SUBSCRIPTION_PLAN.name,
          description: SUBSCRIPTION_PLAN.description,
        });

        const price = await stripe.prices.create({
          product: product.id,
          unit_amount: SUBSCRIPTION_PLAN.price,
          currency: SUBSCRIPTION_PLAN.currency,
          recurring: {
            interval: SUBSCRIPTION_PLAN.interval as 'month',
          },
        });

        priceId = price.id;
      }
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'https://www.lazy-trends.com'}/dashboard?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'https://www.lazy-trends.com'}/checkout?canceled=true`,
      metadata: {
        userId: user.id,
      },
      subscription_data: {
        trial_period_days: SUBSCRIPTION_PLAN.trialPeriodDays,
        metadata: {
          userId: user.id,
        },
      },
      payment_method_types: ['card'],
      billing_address_collection: 'auto',
      allow_promotion_codes: true,
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (err: any) {
    console.error('Error creating checkout session:', err);
    return NextResponse.json(
      { error: { message: err.message || 'An error occurred during checkout' } },
      { status: 500 }
    );
  }
}
