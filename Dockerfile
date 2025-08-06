FROM n8nio/n8n:latest

USER root

# Install build dependencies
RUN apk add --no-cache python3 make g++ sqlite

# Create directory for custom nodes
RUN mkdir -p /home/node/.n8n/nodes

# Copy the built node package
COPY n8n-nodes-sqlite-memory-1.0.0.tgz /tmp/

# Install the custom node
RUN cd /home/node/.n8n/nodes && \
    npm install /tmp/n8n-nodes-sqlite-memory-1.0.0.tgz && \
    rm /tmp/n8n-nodes-sqlite-memory-1.0.0.tgz

# Set ownership
RUN chown -R node:node /home/node/.n8n

USER node

# Set environment variables
ENV N8N_CUSTOM_EXTENSIONS="/home/node/.n8n/nodes"
ENV N8N_USER_FOLDER="/home/node/.n8n"

EXPOSE 5678