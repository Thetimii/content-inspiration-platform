# Lazy Trends - AI-Powered TikTok Trend Recommendation App

Lazy Trends is a web application that helps small business owners discover trending TikTok content ideas tailored to their niche. The app uses AI to analyze trending TikTok videos and generate personalized content recommendations.

## Features

- User authentication with email and password
- Onboarding flow to collect business information
- AI-powered trending search query generation
- TikTok video scraping and analysis
- Personalized content recommendations
- Clean, simple dashboard interface

## Tech Stack

- **Frontend:** Next.js with TypeScript and Tailwind CSS
- **Backend:** Next.js API routes
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **APIs:**
  - OpenRouter (AI-generated trending search queries)
  - RapidAPI (TikTok scraping)
  - Video Analyzer API

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- npm or yarn
- Supabase account
- OpenRouter API key
- RapidAPI key

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/lazy-trends.git
   cd lazy-trends
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env.local` file in the root directory with the following variables:

   ```
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   OPENROUTER_API_KEY=your-openrouter-api-key
   RAPIDAPI_KEY=your-rapidapi-key
   VIDEO_ANALYZER_URL=https://video-analyzer-y3m4k6qhqq-uc.a.run.app
   ```

4. Set up Supabase:

   - Create a new Supabase project
   - Run the SQL script in `supabase/schema.sql` to set up the database schema
   - Configure authentication to allow email/password sign-ups

5. Start the development server:

   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser to see the app.

## Project Structure

```
lazy-trends/
├── src/
│   ├── app/
│   │   ├── api/                  # API routes
│   │   ├── auth/                 # Authentication pages
│   │   ├── dashboard/            # Dashboard page
│   │   ├── onboarding/           # Onboarding flow
│   │   ├── globals.css           # Global styles
│   │   ├── layout.tsx            # Root layout
│   │   └── page.tsx              # Home page (redirects to login)
│   ├── components/               # Reusable components
│   └── utils/                    # Utility functions
├── supabase/                     # Supabase configuration
├── public/                       # Static assets
├── .env.local                    # Environment variables
└── package.json                  # Project dependencies
```

## Deployment

1. Set up a Supabase project in production
2. Configure environment variables in your hosting platform
3. Deploy the Next.js app to your preferred hosting platform (Vercel, Netlify, etc.)
