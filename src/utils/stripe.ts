import { loadStripe } from '@stripe/stripe-js';
import Stripe from 'stripe';

// Make sure to call `loadStripe` outside of a component's render to avoid
// recreating the `Stripe` object on every render.
export const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
);

export const PRODUCT_ID = 'prod_S8sIksYYQAe6tW';

// Initialize Stripe server-side instance
export const getStripeInstance = () => {
  const secretKey = process.env.STRIPE_SECRET_KEY || '';

  if (!secretKey) {
    console.error('Missing STRIPE_SECRET_KEY environment variable');
    throw new Error('Stripe secret key is missing. Please check your environment variables.');
  }

  return new Stripe(secretKey, {
    apiVersion: '2023-10-16',
  });
};

// Subscription price ID from environment variables
export const SUBSCRIPTION_PRICE_ID = process.env.STRIPE_PRICE_ID;

// Subscription plan details
export const SUBSCRIPTION_PLAN = {
  name: 'Lazy Trends Pro',
  description: 'AI-powered TikTok trend recommendations',
  price: 3995, // $39.95 in cents
  interval: 'month',
  currency: 'usd',
  trialPeriodDays: 7,
};
