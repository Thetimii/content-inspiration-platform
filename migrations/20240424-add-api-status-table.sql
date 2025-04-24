-- Create a table to store API status information
CREATE TABLE IF NOT EXISTS api_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_name TEXT NOT NULL,
  status TEXT NOT NULL,
  details JSONB,
  last_checked TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index on service_name for faster lookups
CREATE INDEX IF NOT EXISTS idx_api_status_service_name ON api_status(service_name);

-- Create a function to update the last_checked timestamp
CREATE OR REPLACE FUNCTION update_api_status_last_checked()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_checked = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically update the last_checked timestamp
CREATE TRIGGER update_api_status_last_checked
BEFORE UPDATE ON api_status
FOR EACH ROW
EXECUTE FUNCTION update_api_status_last_checked();

-- Insert initial records for the services we want to monitor
INSERT INTO api_status (service_name, status, details)
VALUES 
  ('openrouter', 'unknown', '{"message": "Not checked yet"}'),
  ('rapidapi', 'unknown', '{"message": "Not checked yet"}'),
  ('brevo', 'unknown', '{"message": "Not checked yet"}')
ON CONFLICT (id) DO NOTHING;
