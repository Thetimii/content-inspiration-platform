# Video Analyzer Service

This microservice handles video analysis for TikTok videos. It's designed to run on Google Cloud Run and uses the `video-analyzer` Python package to analyze video content.

## Features

- Analyzes TikTok videos using AI vision models
- Extracts insights about video content, style, and audience
- Stores analysis results in Supabase
- Runs in a containerized environment on Google Cloud Run

## Setup

### Prerequisites

- Google Cloud Platform account
- Docker installed locally
- gcloud CLI installed and configured

### Environment Variables

Create a `.env` file with the following variables:

```
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
TOGETHER_API_KEY=your_together_api_key
```

### Local Development

1. Install dependencies:
   ```
   npm install
   ```

2. Install video-analyzer:
   ```
   pip install git+https://github.com/byjlw/video-analyzer.git
   ```

3. Start the server:
   ```
   node server.js
   ```

### Building and Deploying

1. Update the `PROJECT_ID` in `deploy-to-cloud-run.sh` with your GCP project ID.

2. Make the deployment script executable:
   ```
   chmod +x deploy-to-cloud-run.sh
   ```

3. Run the deployment script:
   ```
   ./deploy-to-cloud-run.sh
   ```

4. After deployment, update the `VIDEO_ANALYZER_SERVICE_URL` environment variable in your Next.js application with the Cloud Run service URL.

## API Endpoints

### POST /analyze

Analyzes a video from a URL.

**Request Body:**

```json
{
  "videoUrl": "https://example.com/video.mp4",
  "videoId": "unique-video-id",
  "userId": "user-id-from-supabase",
  "searchQuery": "optional-search-query"
}
```

**Response:**

```json
{
  "success": true,
  "result": "Analysis text describing the video content..."
}
```

## Architecture

This service is designed to offload CPU and memory-intensive video analysis from the main application. It:

1. Receives video URLs and metadata from the main application
2. Downloads and processes videos using the video-analyzer tool
3. Stores analysis results in Supabase
4. Returns the analysis to the main application

The service is containerized using Docker and deployed to Google Cloud Run for scalable, serverless operation.
