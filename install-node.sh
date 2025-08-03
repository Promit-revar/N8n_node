#!/bin/bash

echo "Installing SQLite Memory node for N8N..."

# Method 1: Install in N8N's global location
echo "Installing globally..."
npm install -g n8n-nodes-sqlite-memory-1.0.0.tgz

# Method 2: Set environment variable for N8N to find custom nodes
export N8N_CUSTOM_EXTENSIONS="$HOME/.n8n/nodes"

echo "Node installed. Restart N8N to see the node."
echo "If still not visible, try: N8N_CUSTOM_EXTENSIONS=$HOME/.n8n/nodes n8n start"