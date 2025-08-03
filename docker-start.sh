#!/bin/bash

echo "Starting N8N with SQLite Memory node..."

# Option 1: Using docker-compose (recommended)
if [ -f "docker-compose.yml" ]; then
    echo "Using docker-compose..."
    docker-compose up -d
    echo "N8N started at http://localhost:5678"
    echo "Login: admin / password"
else
    # Option 2: Direct docker run
    echo "Using direct docker run..."
    docker run -it --rm \
        --name n8n \
        -p 5678:5678 \
        -v $(pwd)/docker-deploy:/home/node/.n8n/nodes/sqlite-memory \
        -v n8n_data:/home/node/.n8n \
        n8nio/n8n
fi

echo ""
echo "SQLite Memory node should appear under Transform category"