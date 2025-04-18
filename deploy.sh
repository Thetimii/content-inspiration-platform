#!/bin/bash

# Check for required environment variables
if [ -z "$OPENAI_API_KEY" ]; then
  echo "Error: OPENAI_API_KEY environment variable not set"
  exit 1
fi

if [ -z "$OPENROUTER_API_KEY" ]; then
  echo "Error: OPENROUTER_API_KEY environment variable not set"
  exit 1
fi

# Ensure the output directory exists
mkdir -p output

echo "Deploying video analysis system..."
echo "1. Setup database"
npx supabase migration up

echo "2. Build the application"
npm run build

echo "3. Start the service"
npm run start

echo "The application is now running. Workflow:"
echo "- Generate search queries"
echo "- Scrape videos for these queries"
echo "- Analyze videos with integrated-analyzer.js"
echo "  - Extract audio with ffmpeg"
echo "  - Transcribe with Whisper API"
echo "  - Extract and analyze frames with Llama-Vision-Free"
echo "  - Generate description with Llama"
echo "- Run pattern analysis across videos"
echo ""
echo "Access the dashboard at http://localhost:3000/dashboard" 