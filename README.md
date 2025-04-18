# Content Inspiration Platform

A powerful platform that analyzes content from social media platforms to provide personalized content creation insights and recommendations.

## Features

- **Video Analysis**: Upload videos from TikTok and other platforms for AI-powered analysis
- **Pattern Recognition**: Identify patterns across successful content to inform your strategy
- **Daily Inspiration**: Get fresh content ideas based on trending topics and your business profile
- **Personalized Recommendations**: Receive tailored advice based on your business type and goals

## Technology Stack

- **Frontend**: Next.js, React, Tailwind CSS
- **Backend**: Node.js with Next.js API routes
- **Database**: PostgreSQL with Supabase
- **AI Integration**: Together.ai for content analysis
- **Authentication**: Supabase Auth

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm or yarn
- Python 3.10+ (for video analysis)
- Supabase account and project

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/sagertim02/content-inspiration-platform.git
cd content-inspiration-platform
```

2. **Install dependencies**

```bash
npm install
# or
yarn install
```

3. **Set up environment variables**

Create a `.env.local` file in the root directory with the following variables:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
TOGETHER_API_KEY=your_together_api_key
```

4. **Set up the Python video analyzer**

```bash
bash scripts/setup-video-analyzer.sh
```

5. **Run the development server**

```bash
npm run dev
# or
yarn dev
```

6. **Open [http://localhost:3000](http://localhost:3000) in your browser**

## Database Setup

Execute the migrations in the `supabase/migrations` folder to set up your database:

```bash
npx supabase-cli db push
```

Or manually run the SQL files in the Supabase SQL editor in the following order:
1. `20240000000000_init.sql`
2. `20240327000000_add_pattern_analyses.sql`
3. `20240417000000_add_video_analysis.sql`

## Usage

1. **Sign up and complete onboarding**
   - Provide information about your business and goals

2. **Analyze Videos**
   - Navigate to the "Analyzed Videos" section
   - Enter keywords to search for relevant videos
   - Select videos to analyze
   - View individual video analyses

3. **View Pattern Analysis**
   - Go to "Today's Inspiration" to see pattern analysis across multiple videos
   - Review sectioned insights with actionable recommendations

4. **Implement Recommendations**
   - Use the structured insights to create your own content
   - Follow technical requirements and optimization tips

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- Together.ai for providing the AI capabilities
- Supabase for database and authentication
- Next.js and React teams for the frontend framework 