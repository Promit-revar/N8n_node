#!/bin/bash
echo "Starting N8N with SQLite Memory node..."
echo "1. Open browser to http://localhost:5678"
echo "2. Create a new workflow"
echo "3. Look for 'SQLite Memory' node in the node panel"
echo "4. Test the operations as described below"
echo ""
echo "Press Ctrl+C to stop N8N"
echo ""

# Set custom extensions path and start N8N
export N8N_CUSTOM_EXTENSIONS="$HOME/.n8n/nodes"
n8n start