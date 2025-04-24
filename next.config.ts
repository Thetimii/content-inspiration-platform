import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // Public environment variables
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,

    // API keys and secrets - these will be available server-side only
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    RAPIDAPI_KEY: process.env.RAPIDAPI_KEY,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    BREVO_API_KEY: process.env.BREVO_API_KEY,

    // Other configuration
    VIDEO_ANALYZER_URL: process.env.VIDEO_ANALYZER_URL || 'https://video-analyzer-y3m4k6qhqq-uc.a.run.app',
  },
  images: {
    domains: ['www.tiktok.com'],
  },
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
