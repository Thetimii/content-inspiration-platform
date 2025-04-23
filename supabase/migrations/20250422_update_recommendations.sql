-- Add video_ids column to recommendations table
ALTER TABLE recommendations
ADD COLUMN IF NOT EXISTS video_ids UUID[] DEFAULT '{}';
