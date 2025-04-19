#!/bin/bash

# API URL
API_URL="https://video-analyzer-y3m4k6qhqq-uc.a.run.app"
OPENROUTER_API_KEY="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"

# Sample video URL - using a short sample video
VIDEO_URL="https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"

echo "Step 1: Registering video URL..."
REGISTER_RESPONSE=$(curl -s -X POST \
  "${API_URL}/upload-url" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"${VIDEO_URL}\"}")

echo "Register Response: $REGISTER_RESPONSE"

# Extract session_id from the response
SESSION_ID=$(echo $REGISTER_RESPONSE | grep -o '"session_id":"[^"]*"' | cut -d'"' -f4)

if [ -z "$SESSION_ID" ]; then
  echo "Error: Failed to get session_id"
  exit 1
fi

echo "Session ID: $SESSION_ID"

echo "Step 2: Starting analysis..."
ANALYZE_RESPONSE=$(curl -s -X POST \
  "${API_URL}/analyze/${SESSION_ID}" \
  -d "client=openrouter" \
  -d "api-key=${OPENROUTER_API_KEY}" \
  -d "model=meta-llama/llama-4-maverick:free" \
  -d "max-frames=3" \
  -d "whisper-model=tiny" \
  -d "duration=10")

echo "Analyze Response: $ANALYZE_RESPONSE"

echo "Step 3: Streaming analysis logs in real-time..."
echo "Press Ctrl+C when you want to stop streaming and check results"

# Stream the logs in real-time
curl -N "${API_URL}/analyze/${SESSION_ID}/stream"

# Give user a chance to read the final logs
echo "\nStreaming complete. Waiting 5 seconds before getting results..."
sleep 5

echo "Step 4: Getting results..."
RESULTS_RESPONSE=$(curl -s "${API_URL}/results/${SESSION_ID}")

echo "Results:"
echo "$RESULTS_RESPONSE" | head -n 50
echo "..."
echo "(Results truncated for readability)"

echo "Test complete!"
