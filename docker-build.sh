#!/bin/bash

echo "Building N8N with SQLite Memory Node..."

# Build the node package
echo "1. Building node package..."
npm run build
npm pack

# Build Docker image
echo "2. Building Docker image..."
docker-compose build

echo "3. Starting N8N container..."
docker-compose up -d

echo ""
echo "✅ N8N with SQLite Memory is running!"
echo "🌐 Access at: http://localhost:5678"
echo "📁 Import workflows from: ./workflows/"
echo ""
echo "To stop: docker-compose down"
echo "To view logs: docker-compose logs -f"