# Video Analysis Service

This is an external service for analyzing TikTok videos using the DashScope API. It's designed to run independently of Vercel's timeout limitations.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file with the following variables:
```
DASHSCOPE_API_KEY=your_dashscope_api_key
PORT=3000 # Optional, defaults to 3000
```

3. Start the service:
```bash
npm start
```

## Deployment Options

### Option 1: Deploy to a VPS (DigitalOcean, Linode, etc.)

1. Set up a VPS with Node.js installed
2. Clone this repository
3. Install dependencies: `npm install`
4. Set up environment variables
5. Start the service: `npm start`
6. (Optional) Use PM2 to keep the service running: `pm2 start video-analysis-service.js`

### Option 2: Deploy to AWS Lambda

1. Create a Lambda function
2. Set up environment variables
3. Deploy the code
4. Set up an API Gateway to expose the Lambda function

### Option 3: Deploy to Google Cloud Functions

1. Create a Cloud Function
2. Set up environment variables
3. Deploy the code

## Usage

Once deployed, add the following environment variables to your Vercel project:

```
VIDEO_ANALYSIS_SERVICE_URL=https://your-service-url
WEBHOOK_SECRET=your_webhook_secret
```

The service exposes the following endpoints:

### Health Check

```
GET /health
```

Returns:
```json
{
  "status": "ok"
}
```

### Analyze Video

```
POST /analyze
```

Request body:
```json
{
  "videoId": "the-video-id",
  "videoUrl": "https://example.com/video.mp4",
  "webhookUrl": "https://your-app.com/api/video-analysis-webhook",
  "webhookSecret": "your_webhook_secret"
}
```

Response:
```json
{
  "status": "processing",
  "message": "Video analysis started",
  "videoId": "the-video-id"
}
```

The service will analyze the video in the background and call the webhook URL when done.

## Webhook Format

When analysis is complete, the service will call the webhook URL with:

Success:
```json
{
  "videoId": "the-video-id",
  "status": "completed",
  "analysis": "The analysis text..."
}
```

Failure:
```json
{
  "videoId": "the-video-id",
  "status": "failed",
  "error": "Error message"
}
```

The webhook call includes an Authorization header:
```
Authorization: Bearer your_webhook_secret
```
