#!/bin/bash

# API URL
API_URL="https://video-analyzer-api-y3m4k6qhqq-uc.a.run.app"

# Test the root endpoint (health check)
echo "Testing health check endpoint..."
curl -s $API_URL

# Test the analyze endpoint with a sample TikTok video
echo -e "\n\nTesting analyze endpoint..."
echo "This may take a minute or two to process the video..."

# Try with a shorter test video URL
curl -v -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://v16-webapp.tiktok.com/6c5c3f2e9b7c9e2e2e2e2e2e2e2e2e2e/6803cd84/video/tos/useast2a/tos-useast2a-pve-0068/oMQABgfAZIAzbehTCAQiAOLIoAzEIXTgIAfOqR/"
  }' \
  $API_URL/analyze

echo -e "\nTest complete!"
