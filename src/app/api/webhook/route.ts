import { NextResponse } from 'next/server';
import Stripe from 'stripe';

// Initialize Stripe directly with the secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16' as any,
});

// This is your Stripe webhook secret
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'we_1RH6CRG4vQYDStWYJIIk27cL';

export async function POST(req: Request) {
  // Log the request for debugging
  console.log('Webhook received:', new Date().toISOString());

  try {
    // Get the raw body as text
    const body = await req.text();
    console.log('Webhook body length:', body.length);

    // Get the signature from headers
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      console.error('No Stripe signature found in headers');
      return NextResponse.json({ error: 'No Stripe signature found' }, { status: 400 });
    }

    // Verify the event
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      console.log('Webhook verified, event type:', event.type);
    } catch (err: any) {
      console.error(`Webhook signature verification failed: ${err.message}`);
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    // Log the event data for debugging
    console.log('Event type:', event.type);
    console.log('Event ID:', event.id);

    // For now, just acknowledge receipt of the event
    return NextResponse.json({ received: true, success: true });
  } catch (err: any) {
    // Log the full error for debugging
    console.error('Webhook error:', err);
    console.error(`Error message: ${err.message}`);
    console.error(`Error stack: ${err.stack}`);

    // Return a more detailed error response
    return NextResponse.json(
      {
        error: `Webhook error: ${err.message}`,
        success: false,
        timestamp: new Date().toISOString()
      },
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