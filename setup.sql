-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- Drop existing table if it exists
drop table if exists user_onboarding;

-- Create the user_onboarding table with updated fields
create table user_onboarding (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) not null,
  business_type text not null,
  business_location text not null,
  social_media_goal text not null,
  experience_level text not null,
  weekly_time_investment text not null,
  email_notifications boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add trigger for updating the updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger update_user_onboarding_updated_at
    before update on user_onboarding
    for each row
    execute function update_updated_at_column();

-- Set up Row Level Security (RLS)
alter table user_onboarding enable row level security;

-- Create policies for all operations
-- Allow users to insert their own onboarding data
create policy "Users can insert their own onboarding data"
  on user_onboarding
  for insert
  with check (auth.uid() = user_id);

-- Allow users to view their own onboarding data
create policy "Users can view their own onboarding data"
  on user_onboarding
  for select
  using (auth.uid() = user_id);

-- Allow users to update their own onboarding data
create policy "Users can update their own onboarding data"
  on user_onboarding
  for update
  using (auth.uid() = user_id);

-- Allow users to delete their own onboarding data
create policy "Users can delete their own onboarding data"
  on user_onboarding
  for delete
  using (auth.uid() = user_id);

-- Create an index on user_id for better query performance
create index idx_user_onboarding_user_id on user_onboarding(user_id);

-- Grant necessary permissions to authenticated users
grant usage on schema public to authenticated;
grant all on user_onboarding to authenticated; 