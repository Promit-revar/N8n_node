# SQLite Memory Node - Docker Deployment

## Quick Setup

1. Copy these files to your N8N Docker custom nodes directory:
   - `SqliteMemory.node.js`
   - `SqliteMemory.node.d.ts`
   - `package.json`

2. Restart your N8N Docker container

3. The "SQLite Memory" node will appear under Transform category

## Docker Compose Example

```yaml
volumes:
  - ./docker-deploy:/home/node/.n8n/nodes/sqlite-memory
```

## Files Included

- `SqliteMemory.node.js` - Compiled node implementation
- `SqliteMemory.node.d.ts` - TypeScript definitions
- `package.json` - Node configuration for N8N

## Dependencies

Requires `sqlite3` package (usually already available in N8N Docker images).