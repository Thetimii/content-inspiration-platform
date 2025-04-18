#!/bin/bash

# Exit on any error
set -e

# Configuration
PROJECT_ID="freeimage-3fc29"  # Replace with your GCP project ID
SERVICE_NAME="video-analyzer-service"
REGION="us-central1"  # Replace with your preferred region

# Load environment variables from .env file
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
else
  echo "Error: .env file not found"
  exit 1
fi

# Check for required environment variables
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ] || [ -z "$TOGETHER_API_KEY" ]; then
  echo "Error: Missing required environment variables in .env file"
  exit 1
fi

# Build the Docker image using buildx
echo "Building Docker image with buildx..."

# Create and use a new builder if it doesn't exist
docker buildx create --name multiplatform --use 2>/dev/null || docker buildx use multiplatform
docker buildx inspect --bootstrap

# Build and push the image directly
docker buildx build --platform=linux/amd64 --push -t gcr.io/$PROJECT_ID/$SERVICE_NAME .

# Image is already pushed by buildx
echo "Image built and pushed to Google Container Registry"

# Deploy to Cloud Run
echo "Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --set-env-vars="SUPABASE_URL=$SUPABASE_URL,SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY,TOGETHER_API_KEY=$TOGETHER_API_KEY" \
  --memory 1Gi \
  --cpu 1 \
  --timeout 300s \
  --concurrency 10

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)')
echo "Service deployed successfully to: $SERVICE_URL"
echo "Use this URL in your Next.js application to call the video analysis service."
