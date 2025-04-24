import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { getStripeInstance } from '@/utils/stripe';

// Use the getStripeInstance function to get the Stripe instance
const stripe = getStripeInstance();

// This is your Stripe webhook secret for testing your endpoint locally.
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'we_1RH6CRG4vQYDStWYJIIk27cL';

export async function POST(req: Request) {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);

  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature') as string;

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error(`Webhook signature verification failed: ${err.message}`);
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        // Extract the customer and subscription IDs
        const customerId = session.customer;
        const subscriptionId = session.subscription;
        const userId = session.metadata?.userId;

        if (userId && customerId && subscriptionId) {
          // Retrieve the subscription to get its status
          const subscription = await stripe.subscriptions.retrieve(subscriptionId as string);

          // Update user's subscription status in Supabase
          await supabase
            .from('users')
            .update({
              is_subscribed: true,
              stripe_customer_id: customerId as string,
              stripe_subscription_id: subscriptionId as string,
              subscription_status: subscription.status,
              trial_end_date: subscription.trial_end
                ? new Date(subscription.trial_end * 1000).toISOString()
                : null,
            })
            .eq('id', userId);

          console.log(`Updated subscription status for user ${userId}`);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;

        // Find the user with this subscription
        const { data: users } = await supabase
          .from('users')
          .select('id')
          .eq('stripe_subscription_id', subscription.id)
          .limit(1);

        if (users && users.length > 0) {
          const userId = users[0].id;

          await supabase
            .from('users')
            .update({
              subscription_status: subscription.status,
              trial_end_date: subscription.trial_end
                ? new Date(subscription.trial_end * 1000).toISOString()
                : null,
            })
            .eq('id', userId);

          console.log(`Updated subscription status to ${subscription.status} for user ${userId}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;

        // Find the user with this subscription
        const { data: users } = await supabase
          .from('users')
          .select('id')
          .eq('stripe_subscription_id', subscription.id)
          .limit(1);

        if (users && users.length > 0) {
          const userId = users[0].id;

          await supabase
            .from('users')
            .update({
              is_subscribed: false,
              subscription_status: 'canceled',
            })
            .eq('id', userId);

          console.log(`Marked subscription as canceled for user ${userId}`);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;

        // If this is a subscription invoice, update the subscription status
        if (invoice.subscription) {
          const { data: users } = await supabase
            .from('users')
            .select('id')
            .eq('stripe_subscription_id', invoice.subscription)
            .limit(1);

          if (users && users.length > 0) {
            const userId = users[0].id;

            // Update the subscription status to active if it was in a trial
            await supabase
              .from('users')
              .update({
                subscription_status: 'active',
              })
              .eq('id', userId)
              .eq('subscription_status', 'trialing');

            console.log(`Updated subscription status to active for user ${userId} after successful payment`);
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;

        // If this is a subscription invoice, update the subscription status
        if (invoice.subscription) {
          const { data: users } = await supabase
            .from('users')
            .select('id, email')
            .eq('stripe_subscription_id', invoice.subscription)
            .limit(1);

          if (users && users.length > 0) {
            const userId = users[0].id;

            // Update the subscription status to past_due
            await supabase
              .from('users')
              .update({
                subscription_status: 'past_due',
              })
              .eq('id', userId);

            console.log(`Updated subscription status to past_due for user ${userId} after failed payment`);

            // Here you could also send an email to the user about the failed payment
          }
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error(`Webhook error: ${err.message}`);
    return NextResponse.json(
      { error: `Webhook error: ${err.message}` },
      { status: 500 }
    );
  }
}

// This is needed to disable the default body parser
export const config = {
  api: {
    bodyParser: false,
  },
};