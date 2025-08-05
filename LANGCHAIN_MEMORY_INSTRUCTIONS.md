# SQLite Memory for AI Agent - Setup Instructions

## Issue
The SQLite Memory LangChain node won't appear in the Memory section because N8N's LangChain nodes are part of the core `@n8n/n8n-nodes-langchain` package.

## Solution: Use the Workflow Approach

Since we can't directly add to the LangChain Memory section, use this workflow pattern:

### 1. Simple AI Agent with SQLite Memory

```
Chat Trigger → SQLite Memory (Auto-Store User) → AI Agent → SQLite Memory (Auto-Store AI)
```

**Workflow Configuration:**

1. **Chat Trigger**
   - Provides `chatInput` field

2. **SQLite Memory (Auto-Store User)**
   - Operation: `autoStoreUser`
   - Session Key: `={{ $json.sessionId || "chat-session" }}`

3. **AI Agent**
   - Configure with OpenAI model
   - Use built-in Simple Memory (temporary)
   - Prompt: `={{ $json.chatInput }}`

4. **SQLite Memory (Auto-Store AI)**
   - Operation: `autoStoreAI`
   - Session Key: `={{ $json.sessionId || "chat-session" }}`

### 2. Advanced: Context-Aware AI Agent

```
Chat Trigger → Store User → Get Context → Set Prompt → AI Agent → Store AI
```

**Enhanced Configuration:**

1. **Chat Trigger**

2. **SQLite Memory (Store User)**
   - Operation: `autoStoreUser`
   - Session Key: `chat-session`

3. **SQLite Memory (Get Context)**
   - Operation: `smartContext`
   - Session Key: `chat-session`
   - Token Limit: `3000`
   - AI Model: `gpt-3.5-turbo`

4. **Set Node (Create Prompt)**
   - Field: `prompt`
   - Value: `Context: {{ $json.messages.map(m => m.role + ': ' + m.content).join('\n') }}\n\nUser: {{ $('Chat Trigger').first().json.chatInput }}`

5. **AI Agent**
   - Prompt: `={{ $json.prompt }}`

6. **SQLite Memory (Store AI)**
   - Operation: `autoStoreAI`
   - Session Key: `chat-session`

## Benefits of This Approach

1. **Persistent Memory**: SQLite storage survives N8N restarts
2. **Context Awareness**: Smart token management
3. **Session Management**: Multiple conversations
4. **Metadata Tracking**: Model, tokens, timestamps
5. **Flexible**: Works with any AI model/agent

## Alternative: Manual Memory Connection

If you need the memory to appear in the AI Agent's memory section, you would need to:

1. Fork the `@n8n/n8n-nodes-langchain` repository
2. Add the SQLite memory node to that package
3. Build and install the modified package

This is more complex but would give you the native memory connection.

## Recommendation

Use the **workflow approach** above - it provides the same functionality with better flexibility and easier maintenance.