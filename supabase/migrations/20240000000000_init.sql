-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- Drop existing tables if they exist
drop table if exists video_analysis;
drop table if exists tiktok_videos;
drop table if exists search_queries;
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

-- Create the search_queries table
create table search_queries (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  query text not null,
  relevance_score float not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create the tiktok_videos table with download_url column
create table tiktok_videos (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  video_id text not null,
  title text not null,
  cover_url text not null,
  video_url text not null,
  download_url text not null, -- Added download_url column
  author text not null,
  play_count bigint not null,
  like_count bigint not null,
  comment_count bigint not null,
  share_count bigint not null,
  search_query text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create the video_analysis table
create table video_analysis (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  video_id text not null,
  analysis_result jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
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

-- Set up Row Level Security (RLS) for all tables
alter table user_onboarding enable row level security;
alter table search_queries enable row level security;
alter table tiktok_videos enable row level security;
alter table video_analysis enable row level security;

-- Create policies for user_onboarding
create policy "Users can insert their own onboarding data"
  on user_onboarding for insert
  with check (auth.uid() = user_id);

create policy "Users can view their own onboarding data"
  on user_onboarding for select
  using (auth.uid() = user_id);

create policy "Users can update their own onboarding data"
  on user_onboarding for update
  using (auth.uid() = user_id);

create policy "Users can delete their own onboarding data"
  on user_onboarding for delete
  using (auth.uid() = user_id);

-- Create policies for search_queries
create policy "Users can insert their own search queries"
  on search_queries for insert
  with check (auth.uid() = user_id);

create policy "Users can view their own search queries"
  on search_queries for select
  using (auth.uid() = user_id);

create policy "Users can delete their own search queries"
  on search_queries for delete
  using (auth.uid() = user_id);

-- Create policies for tiktok_videos
create policy "Users can insert their own video data"
  on tiktok_videos for insert
  with check (auth.uid() = user_id);

create policy "Users can view their own video data"
  on tiktok_videos for select
  using (auth.uid() = user_id);

create policy "Users can delete their own video data"
  on tiktok_videos for delete
  using (auth.uid() = user_id);

-- Create policies for video_analysis
create policy "Users can insert their own video analysis"
  on video_analysis for insert
  with check (auth.uid() = user_id);

create policy "Users can view their own video analysis"
  on video_analysis for select
  using (auth.uid() = user_id);

create policy "Users can delete their own video analysis"
  on video_analysis for delete
  using (auth.uid() = user_id);

-- Create indexes for better query performance
create index idx_user_onboarding_user_id on user_onboarding(user_id);
create index idx_search_queries_user_id on search_queries(user_id);
create index idx_tiktok_videos_user_id on tiktok_videos(user_id);
create index idx_tiktok_videos_search_query on tiktok_videos(search_query);
create index idx_video_analysis_user_id on video_analysis(user_id);
create index idx_video_analysis_video_id on video_analysis(video_id);

-- Grant necessary permissions to authenticated users
grant usage on schema public to authenticated;
grant all on user_onboarding to authenticated;
grant all on search_queries to authenticated;
grant all on tiktok_videos to authenticated;
grant all on video_analysis to authenticated; 