-- Add last_analyzed_at column to tiktok_videos table
ALTER TABLE tiktok_videos ADD COLUMN IF NOT EXISTS last_analyzed_at TIMESTAMP WITH TIME ZONE;
