import { loadStripe } from '@stripe/stripe-js';
import Stripe from 'stripe';

// Initialize Stripe client-side instance
export const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
);

// Initialize Stripe server-side instance
export const getStripe = () => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  
  if (!secretKey) {
    throw new Error('Missing STRIPE_SECRET_KEY environment variable');
  }
  
  return new Stripe(secretKey, {
    apiVersion: '2023-10-16',
  });
};

// Subscription plan details
export const SUBSCRIPTION_PLAN = {
  name: 'Lazy Trends Pro',
  description: 'AI-powered TikTok trend recommendations',
  price: 3995, // $39.95 in cents
  currency: 'usd',
  interval: 'month',
  trialPeriodDays: 7,
};
