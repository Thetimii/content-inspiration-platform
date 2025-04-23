-- Add video_ids column to recommendations table
-- To apply this migration, run the following SQL in the Supabase SQL Editor:
-- ALTER TABLE recommendations ADD COLUMN video_ids UUID[] DEFAULT '{}';

ALTER TABLE recommendations ADD COLUMN video_ids UUID[] DEFAULT '{}';
