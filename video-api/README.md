# Video Analyzer API

A simple Flask API that wraps the [video-analyzer](https://github.com/byjlw/video-analyzer) tool and deploys it to Google Cloud Run.

## Features

- Analyzes videos using OpenRouter's free Llama Vision model
- Simple REST API interface
- Runs in Google Cloud Run (serverless)

## Deployment

1. Make sure you have the Google Cloud SDK installed and configured:
   ```
   gcloud auth login
   gcloud config set project freeimage-3fc29
   ```

2. Set your OpenRouter API key as an environment variable:
   ```
   export NEXT_PUBLIC_OPENROUTER_API_KEY=your_openrouter_api_key
   ```

3. Run the deployment script:
   ```
   cd video-api
   ./deploy.sh
   ```

4. The script will output the URL of your deployed service. Use this URL in your Next.js application.

## API Usage

### Analyze a Video

```bash
curl -X POST https://your-cloud-run-url/analyze \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/video.mp4"}'
```

Response:

```json
{
  "description": "This TikTok video shows a person demonstrating a cooking technique..."
}
```

## Integration with Next.js

Update your Next.js API route to call this service:

```typescript
// In src/app/api/analyze/route.ts
const VIDEO_ANALYZER_API_URL = process.env.VIDEO_ANALYZER_API_URL;

// In your API route handler
const response = await fetch(`${VIDEO_ANALYZER_API_URL}/analyze`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ url: videoUrl }),
});

const data = await response.json();
const description = data.description;
```
