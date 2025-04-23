import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

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
        const userId = session.metadata?.userId;
        
        if (userId) {
          // Update user's subscription status in Supabase
          await supabase
            .from('users')
            .update({
              is_subscribed: true,
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: session.subscription as string,
              subscription_status: 'trialing',
              trial_end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
            })
            .eq('id', userId);
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
