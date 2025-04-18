#!/bin/bash
set -e

echo "Setting up Python and dependencies for video-analyzer..."

# Install Python if needed
if ! command -v python3 &> /dev/null; then
  echo "Installing Python..."
  apt-get update
  apt-get install -y python3 python3-pip
fi

# Install ffmpeg if needed
if ! command -v ffmpeg &> /dev/null; then
  echo "Installing ffmpeg..."
  apt-get update
  apt-get install -y ffmpeg
fi

# Install video-analyzer
echo "Installing video-analyzer..."
pip3 install git+https://github.com/byjlw/video-analyzer.git

echo "Verifying installation..."
if command -v video-analyzer &> /dev/null; then
  echo "✅ video-analyzer successfully installed"
  video-analyzer --version
else
  echo "⚠️ video-analyzer installation failed, will use fallback mode"
fi

echo "Setup complete!" 