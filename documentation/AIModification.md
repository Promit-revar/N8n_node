# AI Integration Modification Plan for SQLite Memory Node

## Overview
This document outlines the modifications needed to enhance the SQLite Memory node for seamless integration with AI Agent nodes in N8N workflows.

## Current State Analysis

### Existing Features
- Basic SQLite storage with session-based memory
- Three operations: Get Messages, Add Message, Clear Memory
- Simple message structure: `{ role: 'user' | 'ai', content: string }`
- Auto-cleanup (maintains last 50 messages per session)
- Singleton database pattern

### Current Limitations for AI Integration
1. **No automatic input processing** - Requires manual role/content specification
2. **No AI response handling** - Cannot automatically capture AI outputs
3. **Limited message format** - No support for metadata, timestamps, or message IDs
4. **No conversation context formatting** - Cannot format messages for AI consumption
5. **No smart session management** - No automatic session key generation
6. **No integration hooks** - No built-in connection patterns for AI workflows

## Proposed Modifications

### Phase 1: Enhanced Message Structure & Operations

#### 1.1 Extended Message Schema
**Current:**
```typescript
type Message = { role: 'user' | 'ai'; content: string };
```

**Enhanced:**
```typescript
type Message = {
  id: string;                    // Unique message identifier
  role: 'user' | 'assistant' | 'system';  // OpenAI-compatible roles
  content: string;               // Message content
  timestamp: number;             // Unix timestamp
  metadata?: {                   // Optional metadata
    model?: string;              // AI model used
    tokens?: number;             // Token count
    cost?: number;               // API cost
    processingTime?: number;     // Response time
    [key: string]: any;          // Extensible metadata
  };
};
```

#### 1.2 New Operations
Add the following operations to existing ones:

**A. Auto-Store User Input**
- Automatically captures user input from previous node
- Auto-generates session key if not provided
- Stores with 'user' role and timestamp

**B. Auto-Store AI Response**
- Automatically captures AI response from previous node
- Extracts content from various AI node output formats
- Stores with 'assistant' role and metadata

**C. Format for AI**
- Retrieves conversation history
- Formats messages in OpenAI-compatible format
- Returns structured conversation array

**D. Smart Context Window**
- Intelligent message selection based on token limits
- Prioritizes recent messages while maintaining context
- Supports different AI model token limits

### Phase 2: AI Workflow Integration

#### 2.1 Input Auto-Detection
```typescript
// Detect input type and auto-process
interface InputDetection {
  detectUserMessage(input: any): string | null;
  detectAIResponse(input: any): { content: string; metadata?: any } | null;
  detectSessionKey(input: any): string | null;
}
```

#### 2.2 AI Node Output Parsing
Support for common AI node output formats:
- OpenAI Chat Completion responses
- LangChain agent outputs
- Custom AI node responses
- Text generation outputs

#### 2.3 Session Management Enhancement
```typescript
interface SessionManager {
  generateSessionKey(input?: any): string;  // Auto-generate from context
  getOrCreateSession(key?: string): string;
  archiveOldSessions(maxAge: number): void;
}
```

### Phase 3: Advanced Features

#### 3.1 Conversation Templates
Pre-defined conversation starters and system prompts:
```typescript
interface ConversationTemplate {
  name: string;
  systemPrompt: string;
  initialMessages: Message[];
  settings: {
    maxTokens?: number;
    temperature?: number;
    model?: string;
  };
}
```

#### 3.2 Memory Analytics
```typescript
interface MemoryAnalytics {
  getConversationStats(sessionKey: string): {
    messageCount: number;
    totalTokens: number;
    avgResponseTime: number;
    totalCost: number;
  };
  getTopSessions(limit: number): SessionSummary[];
}
```

#### 3.3 Export/Import Functionality
- Export conversations to JSON/CSV
- Import conversation history
- Backup/restore functionality

## Implementation Plan

### Step 1: Database Schema Migration
1. **Backup existing data**
2. **Add new columns to memory table:**
   ```sql
   ALTER TABLE memory ADD COLUMN version INTEGER DEFAULT 1;
   ALTER TABLE memory ADD COLUMN messageCount INTEGER DEFAULT 0;
   ALTER TABLE memory ADD COLUMN totalTokens INTEGER DEFAULT 0;
   ALTER TABLE memory ADD COLUMN lastModel TEXT;
   ```
3. **Create migration function** for existing data

### Step 2: Core Message Structure Update
1. **Update Message type definition**
2. **Modify MemoryStore methods** to handle new structure
3. **Add backward compatibility** for existing data
4. **Implement message ID generation**

### Step 3: New Operations Implementation
1. **Auto-Store User Input operation**
   - Input detection logic
   - Auto session key generation
   - User message storage

2. **Auto-Store AI Response operation**
   - AI response parsing
   - Metadata extraction
   - Response storage with analytics

3. **Format for AI operation**
   - Context window management
   - OpenAI format conversion
   - Token counting integration

4. **Smart Context Window operation**
   - Token limit awareness
   - Intelligent message selection
   - Context preservation logic

### Step 4: UI/UX Enhancements
1. **Update node properties** with new operations
2. **Add conditional field display** based on operation
3. **Implement input validation**
4. **Add helpful descriptions and examples**

### Step 5: Integration Testing
1. **Create test workflows** with various AI nodes
2. **Test auto-detection capabilities**
3. **Validate conversation flow**
4. **Performance testing with large conversations**

## Detailed Code Changes

### 1. Enhanced Node Properties
```typescript
properties: [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    options: [
      // Existing operations...
      {
        name: 'Auto-Store User Input',
        value: 'autoStoreUser',
        description: 'Automatically store user input from previous node',
        action: 'Auto-store user input',
      },
      {
        name: 'Auto-Store AI Response',
        value: 'autoStoreAI',
        description: 'Automatically store AI response with metadata',
        action: 'Auto-store AI response',
      },
      {
        name: 'Format for AI',
        value: 'formatForAI',
        description: 'Format conversation history for AI consumption',
        action: 'Format conversation for AI',
      },
      {
        name: 'Smart Context Window',
        value: 'smartContext',
        description: 'Get context-aware message window',
        action: 'Get smart context window',
      },
    ],
  },
  // Enhanced session key with auto-generation
  {
    displayName: 'Session Key',
    name: 'sessionKey',
    type: 'string',
    default: '',
    placeholder: 'Leave empty for auto-generation',
    description: 'Session identifier (auto-generated if empty)',
  },
  // Token limit for smart context
  {
    displayName: 'Token Limit',
    name: 'tokenLimit',
    type: 'number',
    default: 4000,
    description: 'Maximum tokens for context window',
    displayOptions: {
      show: {
        operation: ['formatForAI', 'smartContext'],
      },
    },
  },
  // AI Model selection for token counting
  {
    displayName: 'AI Model',
    name: 'aiModel',
    type: 'options',
    options: [
      { name: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' },
      { name: 'GPT-4', value: 'gpt-4' },
      { name: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
      { name: 'Claude 3', value: 'claude-3' },
      { name: 'Other', value: 'other' },
    ],
    default: 'gpt-3.5-turbo',
    description: 'AI model for token counting',
    displayOptions: {
      show: {
        operation: ['formatForAI', 'smartContext'],
      },
    },
  },
]
```

### 2. Enhanced MemoryStore Class
```typescript
class MemoryStore {
  // Add token counting utility
  private countTokens(text: string, model: string): number {
    // Implement token counting logic
    // Could use tiktoken or similar library
  }

  // Enhanced message storage with metadata
  async addMessageWithMetadata(
    sessionKey: string, 
    message: Message,
    updateStats: boolean = true
  ): Promise<void> {
    // Implementation with analytics tracking
  }

  // Smart context retrieval
  async getSmartContext(
    sessionKey: string, 
    tokenLimit: number, 
    model: string
  ): Promise<Message[]> {
    // Implementation with token-aware selection
  }

  // Format for AI consumption
  async formatForAI(
    sessionKey: string, 
    tokenLimit: number, 
    model: string
  ): Promise<Array<{role: string, content: string}>> {
    // Implementation returning OpenAI-compatible format
  }
}
```

## Questions for Confirmation

### 1. AI Node Compatibility
**Question:** Which specific AI nodes should we prioritize for integration? [answer: OpenAI and LangChain Agent]
- OpenAI Chat Completion
- LangChain Agent
- Custom AI nodes
- Other specific vendors?

### 2. Token Counting Implementation
**Question:** Should we include a token counting library (like tiktoken) as a dependency, or implement a simpler estimation method?[Answer: Proceed with the best approach]
- **Option A:** Add tiktoken dependency for accurate counting
- **Option B:** Implement character-based estimation
- **Option C:** Make it optional/configurable

### 3. Session Key Auto-Generation Strategy
**Question:** What should be the default strategy for auto-generating session keys?[Answer: UUID-based]
- **Option A:** UUID-based (random)
- **Option B:** Timestamp + user identifier
- **Option C:** Hash of first user message
- **Option D:** Configurable strategy

### 4. Backward Compatibility
**Question:** How important is maintaining 100% backward compatibility with existing workflows?[Answer: for now no need for Backward Compatibility]
- **Option A:** Full compatibility (slower development)
- **Option B:** Migration path with warnings
- **Option C:** Breaking changes with clear upgrade guide

### 5. Performance Considerations
**Question:** Should we implement any performance optimizations for large conversations?[Answer: All of the above]
- **Option A:** Message pagination
- **Option B:** Conversation archiving
- **Option C:** In-memory caching
- **Option D:** All of the above

### 6. Metadata Storage
**Question:** How extensive should the metadata tracking be?[Answer: Basic]
- **Option A:** Basic (model, tokens, timestamp)
- **Option B:** Comprehensive (cost, timing, all AI response metadata)
- **Option C:** Configurable levels

## Timeline Estimate

- **Phase 1 (Core Enhancements):** 2-3 days
- **Phase 2 (AI Integration):** 3-4 days  
- **Phase 3 (Advanced Features):** 2-3 days
- **Testing & Documentation:** 1-2 days

**Total Estimated Time:** 8-12 days

## Risk Assessment

### High Risk
- **Database migration** - Could affect existing data
- **Token counting accuracy** - Different models have different tokenization

### Medium Risk
- **AI node output parsing** - Various formats to handle
- **Performance with large conversations** - Memory and processing concerns

### Low Risk
- **UI/UX changes** - Mostly additive
- **New operations** - Independent of existing functionality

Please review this plan and provide feedback on the questions above so I can proceed with the implementation.