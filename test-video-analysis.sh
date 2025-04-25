#!/bin/bash

# OpenRouter API key
API_KEY="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"

# Video URL from Supabase
VIDEO_URL="https://cxtystgaxoeygwbvgqcg.supabase.co/storage/v1/object/public/tiktok-videos/temp-videos/342fb726-c3ed-4c3b-b655-c82f7af14438-1745527287219.mp4"

# Make the API call
curl -X POST https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -H "HTTP-Referer: https://www.lazy-trends.com" \
  -H "X-Title: Lazy Trends" \
  -d "{
    \"model\": \"qwen/qwen-2.5-vl-72b-instruct\",
    \"messages\": [
      {
        \"role\": \"user\",
        \"content\": [
          {
            \"type\": \"video_url\",
            \"video_url\": {
              \"url\": \"$VIDEO_URL\"
            }
          },
          {
            \"type\": \"text\",
            \"text\": \"What is the content of this video?\"
          }
        ]
      }
    ],
    \"max_tokens\": 4000,
    \"temperature\": 0.7
  }"
