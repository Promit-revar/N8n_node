# n8n-nodes-sqlite-memory

N8N community node for AI Chat Memory with SQLite3 backend. Provides persistent local storage for chat conversations without external dependencies.

## Installation

```bash
npm install n8n-nodes-sqlite-memory
```

## Features

- **Local SQLite Storage**: No external database required
- **Session Management**: Organize conversations by unique session keys
- **Configurable Window**: Retrieve specific number of recent messages
- **Role Support**: Store messages with user/AI role identification
- **Auto-cleanup**: Automatically maintains last 50 messages per session
- **No Configuration**: Works out-of-the-box with zero setup

## Operations

### Get Messages
Retrieves recent messages from a chat session.

**Parameters:**
- `Session Key`: Unique identifier for the chat session
- `Window Size`: Number of recent messages to retrieve (default: 10)

**Output:**
```json
{
  "messages": [
    { "role": "user", "content": "Hello" },
    { "role": "ai", "content": "Hi there!" }
  ],
  "sessionKey": "chat-123",
  "count": 2
}
```

### Add Message
Stores a new message in the chat session.

**Parameters:**
- `Session Key`: Unique identifier for the chat session
- `Role`: Message sender role (user/ai)
- `Message Content`: The message text to store

**Output:**
```json
{
  "success": true,
  "sessionKey": "chat-123",
  "message": {
    "role": "user",
    "content": "Hello"
  }
}
```

### Clear Memory
Removes all messages for a specific session.

**Parameters:**
- `Session Key`: Session to clear

**Output:**
```json
{
  "success": true,
  "sessionKey": "chat-123",
  "cleared": true
}
```

## Database

- **File**: `n8n-memory.sqlite` (created in N8N working directory)
- **No credentials required**: Local file-based storage
- **Auto-created**: Database and tables created automatically
- **Schema**:
  ```sql
  CREATE TABLE memory (
    sessionKey TEXT PRIMARY KEY,
    messages TEXT,
    created INTEGER,
    lastAccessed INTEGER
  )
  ```

## Usage Examples

### Basic Chat Memory
```
[Manual Trigger] → [Add Message: user] → [Add Message: ai] → [Get Messages]
```

### Chat with Context Window
```
[Webhook] → [Add Message] → [Get Messages (window=5)] → [OpenAI] → [Add Message: ai]
```

## Testing

### 1. Unit Test
```bash
node test.js
```

### 2. Local N8N Test
```bash
# Install locally
npm pack
npm install -g ./n8n-nodes-sqlite-memory-1.0.0.tgz

# Start N8N
npx n8n start
```

### 3. Import Test Workflow
1. Start N8N locally
2. Import `workflow-test.json`
3. Execute workflow to test all operations

### 4. Manual Testing
1. Add SQLite Memory node to workflow
2. Set session key (e.g., "test-chat")
3. Test operations:
   - Add user message
   - Add AI response
   - Get messages (verify both appear)
   - Clear memory (verify empty result)

## Troubleshooting

**Node not appearing in N8N:**
- Restart N8N after installation
- Check `~/.n8n/nodes` directory

**Database errors:**
- Ensure N8N has write permissions in working directory
- Check `n8n-memory.sqlite` file is created

**Memory not persisting:**
- Verify session keys are consistent
- Check database file location

## Development

```bash
# Clone and build
git clone <repo>
cd n8n-nodes-sqlite-memory
npm install
npm run build

# Test
npm test
```

## License

MIT
