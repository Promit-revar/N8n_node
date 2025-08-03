#!/bin/bash

echo "SQLite Memory Node - Docker Deployment"
echo "======================================"

# Check if docker-deploy directory exists
if [ ! -d "docker-deploy" ]; then
    echo "Error: docker-deploy directory not found"
    exit 1
fi

echo "Files ready for Docker deployment:"
ls -la docker-deploy/

echo ""
echo "To deploy to your Docker N8N:"
echo "1. Copy docker-deploy/* to your N8N custom nodes directory"
echo "2. Restart your N8N Docker container"
echo ""
echo "Example commands:"
echo "cp docker-deploy/* /path/to/your/n8n/custom-nodes/"
echo "docker restart your-n8n-container"
echo ""
echo "The node will appear as 'SQLite Memory' under Transform category"