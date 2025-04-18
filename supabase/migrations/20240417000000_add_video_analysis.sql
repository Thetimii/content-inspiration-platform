-- Create the video_analysis table
create table video_analysis (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  video_id text not null,
  analysis_result jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up Row Level Security (RLS)
alter table video_analysis enable row level security;

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
create index idx_video_analysis_user_id on video_analysis(user_id);
create index idx_video_analysis_video_id on video_analysis(video_id);

-- Grant necessary permissions to authenticated users
grant all on video_analysis to authenticated; 