export interface SearchQuery {
  query: string;
  relevance_score: number;
  created_at: string;
}

export interface AnalysisResult {
  business_id: string;
  search_queries: SearchQuery[];
  analysis_date: string;
}

export interface BusinessContext {
  business_type: string;
  business_location: string;
}

export interface TikTokVideo {
  video_id: string;
  title: string;
  cover_url: string;
  video_url: string;
  download_url: string;
  author: string;
  stats: {
    play_count: number;
    like_count: number;
    comment_count: number;
    share_count: number;
  };
  created_at: string;
  search_query: string;
} 