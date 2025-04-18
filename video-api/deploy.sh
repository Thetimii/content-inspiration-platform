#!/bin/bash

# Exit on error
set -e

# Configuration
PROJECT_ID="freeimage-3fc29"
SERVICE_NAME="video-analyzer-api"
REGION="us-central1"
OPENROUTER_API_KEY="42e260b35c77b89b1d8495a3c18088c823038a1a3489b199b08ce4e8569f4eba"

# Build and deploy directly to Cloud Run
echo "Building and deploying to Cloud Run..."

gcloud run deploy $SERVICE_NAME \
  --source . \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --set-env-vars="OPENROUTER_API_KEY=$OPENROUTER_API_KEY" \
  --memory 2Gi \
  --cpu 2 \
  --timeout 600s \
  --concurrency 1 \
  --min-instances 1

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)')
echo "Service deployed successfully to: $SERVICE_URL"
echo "Use this URL in your Next.js application to call the video analysis service."
