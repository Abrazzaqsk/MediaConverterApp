#!/bin/bash
set -e

echo "=== Mock Submitting File to Local MediaConvert Server ==="

if [ ! -f myvideo.mp4 ]; then
  echo "Error: myvideo.mp4 not found. Please provide a small real MP4 file for testing ffprobe duration and encoding."
  exit 1
fi

echo "1. Requesting Upload URL..."
URL_RES=$(curl -s -X POST http://localhost:3000/upload-url -H "Content-Type: application/json" -d '{"filename":"myvideo.mp4"}')
UPLOAD_URL=$(echo $URL_RES | grep -o 'http://localhost:3000/local-upload/[^"]*')
KEY=$(echo $URL_RES | grep -o '"key":"[^"]*"' | cut -d'"' -f4)

echo "Got Upload URL: $UPLOAD_URL"

echo "2. Uploading real video to Dev Server S3 mock..."
curl -X PUT "$UPLOAD_URL" -H "Content-Type: video/mp4" --data-binary @myvideo.mp4

echo "3. Starting HLS Conversion (Duration will be probed and tiered price applied)..."
curl -X POST http://localhost:3000/convert \
  -H "Content-Type: application/json" \
  -d "{\"inputBucket\":\"local-bucket\",\"inputKey\":\"$KEY\",\"outputBucket\":\"local-output\",\"outputPrefix\":\"demo-output\",\"profile\":\"adaptive\"}"

echo -e "\n\nConversion finished! Check local-storage/output/demo-output/ for HLS master streams."
