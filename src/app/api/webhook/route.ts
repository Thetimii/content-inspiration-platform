import { NextResponse } from 'next/server';
import Stripe from 'stripe';

export async function POST(req: Request) {
  console.log('Webhook received:', new Date().toISOString());
  
  try {
    // Initialize Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2023-10-16',
    });
    
    // Get the webhook secret
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      console.error('Missing STRIPE_WEBHOOK_SECRET environment variable');
      return NextResponse.json(
        { error: 'Webhook secret is missing' },
        { status: 500 }
      );
    }
    
    // Get the raw body and signature
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');
    
    if (!signature) {
      console.error('No Stripe signature found in headers');
      return NextResponse.json(
        { error: 'No Stripe signature found' },
        { status: 400 }
      );
    }
    
    // Verify the event
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      console.log('Webhook verified, event type:', event.type);
    } catch (err: any) {
      console.error(`Webhook signature verification failed: ${err.message}`);
      return NextResponse.json(
        { error: err.message },
        { status: 400 }
      );
    }
    
    // For now, just acknowledge receipt of the event
    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('Webhook error:', err);
    return NextResponse.json(
      { error: err.message || 'An error occurred processing the webhook' },
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
