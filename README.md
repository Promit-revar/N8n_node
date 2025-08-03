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
npm test
```

### 2. Install and Test in N8N

**Step 1: Build and Install**
```bash
# Build the node
npm run build

# Create package
npm pack

# Install in N8N (choose one method)
# Method A: Global installation
npm install -g ./n8n-nodes-sqlite-memory-1.0.0.tgz

# Method B: Local N8N installation
cp n8n-nodes-sqlite-memory-1.0.0.tgz ~/.n8n/nodes/
cd ~/.n8n/nodes && npm install n8n-nodes-sqlite-memory-1.0.0.tgz
```

**Step 2: Start N8N**
```bash
# Start with custom extensions path
export N8N_CUSTOM_EXTENSIONS="$HOME/.n8n/nodes"
n8n start

# Or use the provided script
./start-n8n.sh
```

**Step 3: Test in N8N Interface**
1. Open http://localhost:5678
2. Create new workflow
3. Search for "SQLite Memory" in node panel
4. Node appears under "Transform" category

### 3. Manual Testing Steps
1. **Add Manual Trigger** node
2. **Add SQLite Memory** node:
   - Operation: "Add Message"
   - Session Key: "test-chat"
   - Role: "user"
   - Content: "Hello!"
3. **Add another SQLite Memory** node:
   - Operation: "Add Message"
   - Session Key: "test-chat"
   - Role: "ai"
   - Content: "Hi there!"
4. **Add final SQLite Memory** node:
   - Operation: "Get Messages"
   - Session Key: "test-chat"
   - Window Size: 10
5. **Execute workflow** - should see both messages

### 4. Import Test Workflow
```bash
# Import workflow-test.json in N8N interface
# Execute to test all operations automatically
```

## Troubleshooting

**Node not appearing in N8N:**
```bash
# Try installation script
./install-node.sh

# Or debug with
./debug-n8n.sh

# Verify installation
ls ~/.n8n/nodes/node_modules/ | grep sqlite
```

**Start N8N with custom extensions:**
```bash
N8N_CUSTOM_EXTENSIONS="$HOME/.n8n/nodes" n8n start
```

**Database errors:**
- Ensure N8N has write permissions in working directory
- Check `n8n-memory.sqlite` file is created
- Database auto-creates on first use

**Memory not persisting:**
- Verify session keys are consistent across operations
- Check database file location in N8N working directory

## Development

```bash
# Setup
npm install
npm run build

# Test core functionality
npm test

# Install for N8N testing
./install-node.sh

# Start N8N for testing
./start-n8n.sh

# Debug installation issues
./debug-n8n.sh
```

## Scripts

- `npm test` - Run unit tests
- `npm run build` - Build TypeScript and copy assets
- `./install-node.sh` - Install node in N8N
- `./start-n8n.sh` - Start N8N with custom extensions
- `./debug-n8n.sh` - Debug node loading issues

## License

MIT
