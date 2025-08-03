#!/bin/bash

# Install the node locally in N8N
npm pack
npm install -g n8n-nodes-sqlite-memory-1.0.0.tgz

# Start N8N
npx n8n start