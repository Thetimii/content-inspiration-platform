-- Add cancel_at column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS cancel_at TIMESTAMP WITH TIME ZONE;
