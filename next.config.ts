import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    RAPIDAPI_KEY: process.env.RAPIDAPI_KEY,
    VIDEO_ANALYZER_URL: process.env.VIDEO_ANALYZER_URL || 'https://video-analyzer-y3m4k6qhqq-uc.a.run.app',
  },
  images: {
    domains: ['www.tiktok.com'],
  },
};

export default nextConfig;
