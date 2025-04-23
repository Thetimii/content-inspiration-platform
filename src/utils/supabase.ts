import { createClient } from '@supabase/supabase-js';

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
}

// Create Supabase client
export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || ''
);

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          business_description: string | null;
          weekly_time_commitment: number | null;
          social_media_experience: 'beginner' | 'intermediate' | 'expert' | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          business_description?: string | null;
          weekly_time_commitment?: number | null;
          social_media_experience?: 'beginner' | 'intermediate' | 'expert' | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          business_description?: string | null;
          weekly_time_commitment?: number | null;
          social_media_experience?: 'beginner' | 'intermediate' | 'expert' | null;
          created_at?: string;
        };
      };
      trend_queries: {
        Row: {
          id: string;
          user_id: string;
          query: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          query: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          query?: string;
          created_at?: string;
        };
      };
      tiktok_videos: {
        Row: {
          id: string;
          trend_query_id: string;
          video_url: string;
          caption: string;
          views: number;
          likes: number;
          downloads: number;
          hashtags: string[];
          summary: string | null;
          created_at: string;
          cover_url: string | null;
          download_url: string | null;
          transcript: string | null;
          frame_analysis: string | null;
          last_analyzed_at: string | null;
        };
        Insert: {
          id?: string;
          trend_query_id: string;
          video_url: string;
          caption: string;
          views: number;
          likes: number;
          downloads: number;
          hashtags: string[];
          summary?: string | null;
          created_at?: string;
          cover_url?: string | null;
          download_url?: string | null;
          transcript?: string | null;
          frame_analysis?: string | null;
          last_analyzed_at?: string | null;
        };
        Update: {
          id?: string;
          trend_query_id?: string;
          video_url?: string;
          caption?: string;
          views?: number;
          likes?: number;
          downloads?: number;
          hashtags?: string[];
          summary?: string | null;
          created_at?: string;
          cover_url?: string | null;
          download_url?: string | null;
          transcript?: string | null;
          frame_analysis?: string | null;
          last_analyzed_at?: string | null;
        };
      };
      recommendations: {
        Row: {
          id: string;
          user_id: string;
          combined_summary: string;
          content_ideas: string;
          created_at: string;
          video_ids?: string[] | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          combined_summary: string;
          content_ideas: string;
          created_at?: string;
          video_ids?: string[] | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          combined_summary?: string;
          content_ideas?: string;
          created_at?: string;
          video_ids?: string[] | null;
        };
      };
    };
  };
};
