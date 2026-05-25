#!/bin/bash

set -e

BASE_URL="http://localhost:8000"

echo "== Running Assignment 4 API tests =="

echo "== Checking API is reachable =="
curl -s "$BASE_URL/businesses" > /tmp/businesses.json

BUSINESS_ID=$(node -e "
const fs = require('fs')
const data = JSON.parse(fs.readFileSync('/tmp/businesses.json'))
const businesses = data.businesses || data
console.log(businesses[0]._id || businesses[0].id)
")

if [ -z "$BUSINESS_ID" ]; then
  echo "Could not find a business ID from GET /businesses"
  exit 1
fi

echo "Using business ID: $BUSINESS_ID"

echo "== Creating test image =="
node -e "
const fs = require('fs')
const pngBase64 =
'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII='
fs.writeFileSync('/tmp/test-image.png', Buffer.from(pngBase64, 'base64'))
fs.writeFileSync('/tmp/not-image.txt', 'this is not an image')
"

echo "== Test 1: Upload valid PNG =="
UPLOAD_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/photos" \
  -F "businessId=$BUSINESS_ID" \
  -F "caption=Test upload" \
  -F "file=@/tmp/test-image.png;type=image/png")

UPLOAD_BODY=$(echo "$UPLOAD_RESPONSE" | sed '$d')
UPLOAD_STATUS=$(echo "$UPLOAD_RESPONSE" | tail -n 1)

if [ "$UPLOAD_STATUS" != "201" ]; then
  echo "Expected status 201, got $UPLOAD_STATUS"
  echo "$UPLOAD_BODY"
  exit 1
fi

PHOTO_ID=$(node -e "
const data = JSON.parse(process.argv[1])
console.log(data.id || data._id)
" "$UPLOAD_BODY")

if [ -z "$PHOTO_ID" ]; then
  echo "Upload response did not include a photo ID"
  echo "$UPLOAD_BODY"
  exit 1
fi

echo "Uploaded photo ID: $PHOTO_ID"

echo "== Test 2: Reject invalid file type =="
BAD_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/photos" \
  -F "businessId=$BUSINESS_ID" \
  -F "caption=Bad upload" \
  -F "file=@/tmp/not-image.txt;type=text/plain")

BAD_STATUS=$(echo "$BAD_RESPONSE" | tail -n 1)

if [ "$BAD_STATUS" = "201" ]; then
  echo "Expected invalid file upload to fail, but it returned 201"
  exit 1
fi

echo "Invalid upload rejected with status $BAD_STATUS"

echo "== Waiting briefly for thumbnail worker =="
sleep 3

echo "== Test 3: Fetch photo metadata =="
PHOTO_RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/photos/$PHOTO_ID")
PHOTO_BODY=$(echo "$PHOTO_RESPONSE" | sed '$d')
PHOTO_STATUS=$(echo "$PHOTO_RESPONSE" | tail -n 1)

if [ "$PHOTO_STATUS" != "200" ]; then
  echo "Expected status 200 from GET /photos/$PHOTO_ID, got $PHOTO_STATUS"
  echo "$PHOTO_BODY"
  exit 1
fi

node -e "
const photo = JSON.parse(process.argv[1])

if (!photo.url) {
  console.error('Photo metadata missing url')
  process.exit(1)
}

if (!photo.thumbUrl) {
  console.error('Photo metadata missing thumbUrl')
  process.exit(1)
}

console.log('Photo URL:', photo.url)
console.log('Thumb URL:', photo.thumbUrl)
" "$PHOTO_BODY"

PHOTO_URL=$(node -e "console.log(JSON.parse(process.argv[1]).url)" "$PHOTO_BODY")
THUMB_URL=$(node -e "console.log(JSON.parse(process.argv[1]).thumbUrl)" "$PHOTO_BODY")

echo "== Test 4: Download original photo =="
curl -s -f "$BASE_URL$PHOTO_URL" --output /tmp/original-download

if [ ! -s /tmp/original-download ]; then
  echo "Downloaded original photo is empty"
  exit 1
fi

echo "== Test 5: Download thumbnail =="
curl -s -f "$BASE_URL$THUMB_URL" --output /tmp/thumb-download.jpg

if [ ! -s /tmp/thumb-download.jpg ]; then
  echo "Downloaded thumbnail is empty"
  exit 1
fi

echo "== All tests passed =="