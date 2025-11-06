#!/bin/bash
set -e

cd frontend
echo "🏗️  Building..."
npm run build

echo "📤 Uploading to S3..."
aws s3 sync build/ s3://esoteric-frontend-1761810133 --delete

echo "🔄 Invalidating CloudFront..."
aws cloudfront create-invalidation \
  --distribution-id E2S8V8V1NOQDDD \
  --paths "/*"

echo "✅ Frontend deployed!"
echo "🌐 URL: https://d3jclgxyamk6z.cloudfront.net"
