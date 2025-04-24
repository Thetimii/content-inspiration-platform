import { loadStripe } from '@stripe/stripe-js';
import Stripe from 'stripe';

// Make sure to call `loadStripe` outside of a component's render to avoid
// recreating the `Stripe` object on every render.
export const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_live_51RERMjG4vQYDStWY80yELhyq6RKUiRwvcuLjiVpXF0Pt9zOp0EKFlGWKYic7DQrStSB717etXBjVH5a7K2qdV74W00jeZOiZcz'
);

export const PRODUCT_ID = 'prod_S8sIksYYQAe6tW';

// Initialize Stripe server-side instance
export const getStripeInstance = () => {
  const secretKey = process.env.STRIPE_SECRET_KEY || '';
  return new Stripe(secretKey, {
    apiVersion: '2023-10-16',
  });
};

// Subscription price ID - replace with your actual price ID
export const SUBSCRIPTION_PRICE_ID = 'price_1RERMjG4vQYDStWYXXXXXXXX';

// Subscription plan details
export const SUBSCRIPTION_PLAN = {
  name: 'Lazy Trends Pro',
  description: 'AI-powered TikTok trend recommendations',
  price: 3995, // $39.95 in cents
  interval: 'month',
  currency: 'usd',
  trialPeriodDays: 7,
};
