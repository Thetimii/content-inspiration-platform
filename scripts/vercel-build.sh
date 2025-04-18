#!/bin/bash
set -e

echo "Setting up dependencies for video-analyzer..."

# Ensure pip is available
python3 -m ensurepip --upgrade || true
python3 -m pip install --upgrade pip || true

# Install video-analyzer and its dependencies
echo "Installing video-analyzer through pip..."
python3 -m pip install git+https://github.com/byjlw/video-analyzer.git || true

echo "Verifying installation..."
if python3 -c "import shutil; print(shutil.which('video-analyzer'))" | grep -q "video-analyzer"; then
  echo "✅ video-analyzer successfully installed"
  # Add video-analyzer to PATH if needed
  export PATH=$PATH:$(python3 -m site --user-base)/bin
  video-analyzer --version || echo "Unable to run video-analyzer directly, but it's installed"
else
  echo "⚠️ video-analyzer installation failed, will use fallback mode"
fi

echo "Setup complete!" 