import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '@/utils/supabase';

export async function POST(req: Request) {
  try {
    // Initialize Stripe directly
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return NextResponse.json(
        { error: 'Stripe secret key is missing' },
        { status: 500 }
      );
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-03-31.basil' as any,
    });

    // Get the webhook secret
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return NextResponse.json(
        { error: 'Webhook secret is missing' },
        { status: 500 }
      );
    }

    // Get the raw body and signature
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'No Stripe signature found' },
        { status: 400 }
      );
    }

    // Verify the event
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      return NextResponse.json(
        { error: err.message },
        { status: 400 }
      );
    }

    // Handle the event
    console.log(`Webhook event type: ${event.type}`);

    // Handle subscription events
    if (event.type.startsWith('customer.subscription.')) {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      // Get the user ID from the subscription metadata or find by customer ID
      let userId = subscription.metadata?.userId;

      if (!userId) {
        // Find user by customer ID
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (userError) {
          console.error('Error finding user by customer ID:', userError);
          return NextResponse.json({ received: true, warning: 'User not found' });
        }

        userId = userData.id;
      }

      // Update subscription status in the database
      const { error: updateError } = await supabase
        .from('users')
        .update({
          stripe_subscription_id: subscription.id,
          subscription_status: subscription.status,
          is_subscribed: ['active', 'trialing'].includes(subscription.status),
          trial_end_date: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null
        })
        .eq('id', userId);

      if (updateError) {
        console.error('Error updating user subscription status:', updateError);
        return NextResponse.json({ received: true, warning: 'Failed to update user subscription status' });
      }

      console.log(`Updated subscription status for user ${userId} to ${subscription.status}`);
    }

    // Handle checkout session completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId = session.customer as string;

      // Get the user ID from the session metadata or find by customer ID
      let userId = session.metadata?.userId;

      if (!userId) {
        // Find user by customer ID
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (userError) {
          console.error('Error finding user by customer ID:', userError);
          return NextResponse.json({ received: true, warning: 'User not found' });
        }

        userId = userData.id;
      }

      // Update user record with customer ID if not already set
      const { error: updateError } = await supabase
        .from('users')
        .update({
          stripe_customer_id: customerId
        })
        .eq('id', userId)
        .is('stripe_customer_id', null);

      if (updateError) {
        console.error('Error updating user with customer ID:', updateError);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred processing the webhook' },
      { status: 500 }
    );
  }
}

// This is needed for Next.js App Router to handle raw bodies
export const config = {
  api: {
    bodyParser: false,
  },
};
