# DashScope API Local Test Server

This is a simple local test server to test the DashScope API without Vercel's timeout limitations.

## Setup

1. Install dependencies:
```bash
npm install express axios dotenv cors
```

2. Add your DashScope API key to the `.env.local-test` file:
```
DASHSCOPE_API_KEY=your_dashscope_api_key_here
```

3. Run the server:
```bash
cp .env.local-test .env
node local-test-server.js
```

4. Open your browser and go to http://localhost:3001

## How it works

1. The server provides a simple web interface where you can see the test video and click a button to analyze it.
2. When you click "Analyze Video", the server makes a request to the DashScope API with the video URL.
3. The server streams the results back to the browser in real-time.
4. You can see the logs and the final analysis result in the web interface.

## Troubleshooting

- If you see an error about the DashScope API key, make sure you've added it to the `.env` file.
- If the analysis takes too long, you can increase the timeout in the server code.
- If the analysis fails, check the logs for more details.

## Notes

- This server is for testing purposes only and should not be used in production.
- The server uses the same video URL that was having issues in the production environment.
- The server implements the same fallback mechanism as the production code.
