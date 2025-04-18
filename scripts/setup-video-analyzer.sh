#!/bin/bash

# Install ffmpeg if not already installed
if ! command -v ffmpeg &> /dev/null; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        brew install ffmpeg
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        sudo apt-get update && sudo apt-get install -y ffmpeg
    else
        echo "Please install ffmpeg manually for your operating system"
        exit 1
    fi
fi

# Create Python virtual environment if it doesn't exist
if [ ! -d ".venv" ]; then
    python3 -m venv .venv
fi

# Activate virtual environment
source .venv/bin/activate

# Install video-analyzer
pip install git+https://github.com/byjlw/video-analyzer.git

# Verify installation
video-analyzer --version

echo "Setup complete! video-analyzer is now installed." 