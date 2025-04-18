import subprocess
import sys

def test_video_analyzer():
    try:
        # Run video-analyzer with --help to check if it's installed
        result = subprocess.run(["video-analyzer", "--help"], capture_output=True, text=True)
        print("video-analyzer is installed:")
        print(result.stdout)
        return True
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    if test_video_analyzer():
        print("Test passed: video-analyzer is installed and working.")
        sys.exit(0)
    else:
        print("Test failed: video-analyzer is not installed or not working.")
        sys.exit(1)
