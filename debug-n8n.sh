#!/bin/bash

echo "Debug: Checking N8N node installation..."

echo "1. Global N8N nodes:"
ls -la /opt/homebrew/lib/node_modules/ | grep n8n

echo -e "\n2. Local N8N nodes:"
ls -la ~/.n8n/nodes/node_modules/ | grep sqlite

echo -e "\n3. Starting N8N with debug info..."
export N8N_LOG_LEVEL=debug
export N8N_CUSTOM_EXTENSIONS="$HOME/.n8n/nodes"
n8n start