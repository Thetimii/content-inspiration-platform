-- Create pattern_analyses table
create table if not exists pattern_analyses (
  id uuid default uuid_generate_v4() primary key,
  num_videos_analyzed integer not null,
  video_analyses jsonb not null,
  pattern_analysis text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table pattern_analyses enable row level security;

-- Create policies
create policy "Users can view their own pattern analyses"
  on pattern_analyses for select
  using (auth.uid() = auth.uid());

create policy "Users can insert their own pattern analyses"
  on pattern_analyses for insert
  with check (auth.uid() = auth.uid());

-- Create updated_at trigger
create trigger handle_updated_at before update on pattern_analyses
  for each row execute procedure moddatetime (updated_at); 