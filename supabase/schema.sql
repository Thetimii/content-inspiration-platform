-- Create tables for the Lazy Trends app

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT NOT NULL,
  business_description TEXT,
  weekly_time_commitment INTEGER,
  social_media_experience TEXT CHECK (social_media_experience IN ('beginner', 'intermediate', 'expert')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trend queries table
CREATE TABLE IF NOT EXISTS trend_queries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TikTok videos table
CREATE TABLE IF NOT EXISTS tiktok_videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trend_query_id UUID NOT NULL REFERENCES trend_queries(id) ON DELETE CASCADE,
  video_url TEXT NOT NULL,
  caption TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  downloads INTEGER NOT NULL DEFAULT 0,
  hashtags TEXT[] NOT NULL DEFAULT '{}',
  summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Recommendations table
CREATE TABLE IF NOT EXISTS recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  combined_summary TEXT NOT NULL,
  content_ideas TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_trend_queries_user_id ON trend_queries(user_id);
CREATE INDEX IF NOT EXISTS idx_tiktok_videos_trend_query_id ON tiktok_videos(trend_query_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_user_id ON recommendations(user_id);

-- Set up Row Level Security (RLS) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE trend_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiktok_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;

-- Users can only read and update their own data
CREATE POLICY users_policy ON users
  FOR ALL
  USING (auth.uid() = id);

-- Users can only read and write their own trend queries
CREATE POLICY trend_queries_policy ON trend_queries
  FOR ALL
  USING (auth.uid() = user_id);

-- Users can only read and write their own videos (via trend queries)
CREATE POLICY tiktok_videos_policy ON tiktok_videos
  FOR ALL
  USING (
    trend_query_id IN (
      SELECT id FROM trend_queries WHERE user_id = auth.uid()
    )
  );

-- Users can only read and write their own recommendations
CREATE POLICY recommendations_policy ON recommendations
  FOR ALL
  USING (auth.uid() = user_id);
