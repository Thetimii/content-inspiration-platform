FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install Python dependencies
RUN pip install flask gunicorn
RUN pip install git+https://github.com/byjlw/video-analyzer.git

# Copy application code
COPY app.py .
COPY test-video-analyzer.py .

# Test if video-analyzer is installed correctly
RUN python test-video-analyzer.py

# Expose port
EXPOSE 8080

# Run the application with Gunicorn
CMD exec gunicorn --bind :8080 --workers 1 --threads 8 --timeout 0 app:app
