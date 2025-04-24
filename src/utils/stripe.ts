import { loadStripe } from '@stripe/stripe-js';

// Initialize Stripe client-side instance
export const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
);

// Subscription plan details
export const SUBSCRIPTION_PLAN = {
  name: 'Lazy Trends Pro',
  description: 'AI-powered TikTok trend recommendations',
  price: 3995, // $39.95 in cents
  currency: 'usd',
  interval: 'month',
  trialPeriodDays: 7,
};
