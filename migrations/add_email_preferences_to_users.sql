-- Add email preferences columns to users table
ALTER TABLE users ADD COLUMN email_notifications BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN email_time_hour INTEGER DEFAULT 9;
ALTER TABLE users ADD COLUMN email_time_minute INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN last_email_sent TIMESTAMP WITH TIME ZONE;
