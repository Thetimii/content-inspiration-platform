import { loadStripe } from '@stripe/stripe-js';

// Make sure to call `loadStripe` outside of a component's render to avoid
// recreating the `Stripe` object on every render.
export const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_live_51RERMjG4vQYDStWY80yELhyq6RKUiRwvcuLjiVpXF0Pt9zOp0EKFlGWKYic7DQrStSB717etXBjVH5a7K2qdV74W00jeZOiZcz'
);

export const PRODUCT_ID = 'prod_S8sIksYYQAe6tW';
