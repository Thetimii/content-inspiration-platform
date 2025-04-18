#!/bin/bash

# API URL
API_URL="https://video-analyzer-api-y3m4k6qhqq-uc.a.run.app"

# Test the root endpoint (health check)
echo "Testing health check endpoint..."
curl -s $API_URL

# Test the analyze endpoint with a sample TikTok video
echo -e "\n\nTesting analyze endpoint..."
echo "This may take a minute or two to process the video..."

curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://v19.tiktokcdn.com/472b179fd10501080042b60b6e5ffe85/6804053e/video/tos/no1a/tos-no1a-ve-0068c001-no/oMByECaBi3bS4rAIDiiQJUBIPLEvYAi7ZYEEA/?a=1233&bti=NEBzNTY6QGo6OjZALnAjNDQuYCMxNDNg&ch=0&cr=0&dr=0&er=0&lr=all&net=0&cd=0%7C0%7C0%7C0&cv=1&br=3500&bt=1750&cs=0&ds=6&ft=pfEtGMvt8Zmo081dwI4jVLZMCWWrKsd.&mime_type=video_mp4&qs=0&rc=aWVpZWY6ZjhkZTQzNjczZEBpajU0bHE5cmU3MzMzbzczNUAtMC80MF5eXi8xNWFjM2JiYSNxNjRhMmRrNi5hLS1kMTFzcw%3D%3D&vvpl=1&l=202504182018512E27E1F762A833FF20AE&btag=e000b8000&cc=4"
  }' \
  $API_URL/analyze | jq

echo -e "\nTest complete!"
