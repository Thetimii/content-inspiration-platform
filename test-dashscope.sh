#!/bin/bash

# DashScope API key - you'll need to replace this with your actual DashScope API key
DASHSCOPE_API_KEY="your_dashscope_api_key"

# Video URL from Supabase
VIDEO_URL="https://cxtystgaxoeygwbvgqcg.supabase.co/storage/v1/object/public/tiktok-videos/temp-videos/342fb726-c3ed-4c3b-b655-c82f7af14438-1745527287219.mp4"

# Make the API call
curl -X POST https://dashscope.aliyuncs-intl.com/compatible-mode/v1/chat/completions \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"qwen-vl-max\",
    \"messages\": [
      {\"role\": \"system\", \"content\": [{\"type\": \"text\",\"text\": \"You are a helpful assistant.\"}]},
      {\"role\": \"user\",\"content\": [
        {\"type\": \"video_url\",\"video_url\": {\"url\": \"$VIDEO_URL\"}},
        {\"type\": \"text\",\"text\": \"What is the content of this video?\"}
      ]}
    ]
  }"
