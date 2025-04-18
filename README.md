# TikTok Video Analysis Application

This application helps users analyze TikTok videos to understand content trends and create better content.

## Architecture

The application consists of two main components:

1. **Next.js Web Application**: The main user interface and API endpoints
2. **Video Analyzer Service**: A microservice running on Google Cloud Run that handles the CPU-intensive video analysis

## Setup Instructions

### Prerequisites

- Node.js 18+
- Docker (for deploying the video analyzer service)
- Google Cloud Platform account
- Supabase account
- Together AI API key
- RapidAPI key (for TikTok API)

### Environment Variables

Copy the `.env.example` file to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

### Local Development (Web App)

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Deploying the Video Analyzer Service

The video analysis has been outsourced to a separate microservice that runs on Google Cloud Run. This prevents the heavy processing from running on your local machine.

1. Navigate to the video analyzer service directory:
   ```bash
   cd video-analyzer-service
   ```

2. Create a `.env` file with your credentials:
   ```bash
   cp .env.example .env
   ```

3. Update the `PROJECT_ID` in `deploy-to-cloud-run.sh` with your GCP project ID.

4. Make the deployment script executable:
   ```bash
   chmod +x deploy-to-cloud-run.sh
   ```

5. Run the deployment script:
   ```bash
   ./deploy-to-cloud-run.sh
   ```

6. After deployment, update the `VIDEO_ANALYZER_SERVICE_URL` in your `.env.local` file with the Cloud Run service URL.

## How It Works

1. Users search for TikTok videos based on keywords
2. Selected videos are sent to the Video Analyzer Service
3. The service analyzes the videos using AI vision models
4. Analysis results are stored in Supabase
5. The web app displays the analysis and recommendations

## Project Structure

- `/src`: Next.js application source code
  - `/app`: Next.js app router components and API routes
  - `/components`: Reusable UI components
  - `/lib`: Utility functions and API clients
  - `/types`: TypeScript type definitions
- `/video-analyzer-service`: Microservice for video analysis
  - `server.js`: Express.js server
  - `Dockerfile`: Container configuration
  - `deploy-to-cloud-run.sh`: Deployment script

## API Endpoints

- `POST /api/analyze`: Forwards video analysis requests to the Cloud Run service
- `POST /api/analyze-patterns`: Analyzes patterns across multiple videos
- `GET /api/search-queries`: Generates search queries based on business context

## Database Schema

The application uses Supabase with the following tables:

- `user_onboarding`: User preferences and business information
- `tiktok_videos`: Metadata for scraped TikTok videos
- `video_analysis`: Results of individual video analyses
- `pattern_analyses`: Results of pattern analysis across multiple videos
- `temp_videos`: Temporary storage for video processing

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request
