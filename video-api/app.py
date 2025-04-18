from flask import Flask, request, jsonify
import subprocess
import json
import os
import tempfile
import shutil
import logging
import sys

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)

app = Flask(__name__)

@app.route('/')
def home():
    return "Video Analyzer API is running"

@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.json
    logger.info(f"Received analyze request: {data}")

    if not data or 'url' not in data:
        logger.error("Missing 'url' parameter")
        return jsonify({"error": "Missing 'url' parameter"}), 400

    video_url = data['url']
    logger.info(f"Processing video URL: {video_url[:50]}...")

    # Create a temporary directory for output
    temp_dir = tempfile.mkdtemp()
    logger.info(f"Created temporary directory: {temp_dir}")

    try:
        # Check if OPENROUTER_API_KEY is set
        api_key = os.environ.get("OPENROUTER_API_KEY")
        if not api_key:
            logger.error("OPENROUTER_API_KEY environment variable is not set")
            return jsonify({"error": "API key not configured"}), 500

        # Run the video-analyzer command with simpler parameters
        cmd = [
            "video-analyzer",
            video_url,
            "--client", "openai_api",
            "--api-key", api_key,
            "--api-url", "https://openrouter.ai/api/v1",
            "--model", "meta-llama/Llama-Vision-Free",
            "--max-frames", "2",  # Using 2 frames for better analysis
            "--duration", "60",   # Using 60 seconds to capture enough content
            "--log-level", "INFO",
            "--whisper-model", "small",  # Changed from medium to small
            "--temperature", "0.7",
            "--output", os.path.join(temp_dir, "analysis.json"),
            "--prompt", "Analyze this TikTok video and provide insights about: 1. Main activities shown 2. Visual elements and equipment 3. Style and techniques 4. Target audience 5. Key tips. Keep the analysis concise."
        ]

        logger.info(f"Running command: {' '.join(cmd[:3])} [...]")
        process = subprocess.run(cmd, capture_output=True, text=True)

        if process.returncode != 0:
            logger.error(f"Video analysis failed with return code {process.returncode}")
            logger.error(f"STDERR: {process.stderr}")
            logger.error(f"STDOUT: {process.stdout}")
            return jsonify({
                "error": "Video analysis failed",
                "details": process.stderr
            }), 500

        # Check if output file exists
        output_file = os.path.join(temp_dir, "analysis.json")
        if not os.path.exists(output_file):
            logger.error(f"Output file not found: {output_file}")
            return jsonify({"error": "Analysis output file not found"}), 500

        logger.info(f"Analysis complete, reading output from {output_file}")

        # Read the analysis output
        with open(output_file, "r") as f:
            analysis_data = json.load(f)

        # Extract the video description
        if "video_description" in analysis_data and "response" in analysis_data["video_description"]:
            description = analysis_data["video_description"]["response"]
            logger.info(f"Successfully extracted description: {description[:50]}...")
            return jsonify({"description": description})
        else:
            logger.error(f"No video description found in analysis output: {analysis_data}")
            return jsonify({"error": "No video description found in analysis output"}), 500

    except Exception as e:
        logger.exception(f"Exception during video analysis: {str(e)}")
        return jsonify({"error": str(e)}), 500

    finally:
        # Clean up the temporary directory
        logger.info(f"Cleaning up temporary directory: {temp_dir}")
        shutil.rmtree(temp_dir, ignore_errors=True)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 8080)))
