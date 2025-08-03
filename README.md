# n8n-nodes-sqlite-memory

N8N community node for AI Chat Memory with SQLite3 backend.

## Installation

```bash
npm install n8n-nodes-sqlite-memory
```

## Features

- Store chat messages in local SQLite database
- Session-based memory management
- Configurable window size for message retrieval
- Support for user and AI message roles
- Memory clearing functionality

## Operations

- **Get Messages**: Retrieve recent messages from memory
- **Add Message**: Store a new message in memory
- **Clear Memory**: Remove all messages for a session

## Usage

1. Add the SQLite Memory node to your workflow
2. Configure the session key to identify your chat session
3. Use "Add Message" to store user/AI messages
4. Use "Get Messages" to retrieve conversation history
5. Use "Clear Memory" to reset the conversation
