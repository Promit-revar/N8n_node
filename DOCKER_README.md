# Docker Deployment for N8N SQLite Memory Node

## 🚀 Quick Start

### **1. Build and Run**
```bash
./docker-build.sh
```

### **2. Manual Build**
```bash
# Build node package
npm run build && npm pack

# Build and start container
docker-compose up -d
```

## 📋 Docker Commands

### **Start Container**
```bash
docker-compose up -d
```

### **Stop Container**
```bash
docker-compose down
```

### **View Logs**
```bash
docker-compose logs -f
```

### **Rebuild Image**
```bash
docker-compose build --no-cache
```

## 🔧 Configuration

### **Environment Variables**
- `N8N_BASIC_AUTH_ACTIVE=false` - Disable basic auth
- `N8N_CUSTOM_EXTENSIONS=/home/node/.n8n/nodes` - Custom nodes path
- `WEBHOOK_URL=http://localhost:5678/` - Webhook base URL

### **Volumes**
- `n8n_data:/home/node/.n8n` - Persistent N8N data
- `./workflows:/home/node/.n8n/workflows` - Example workflows

### **Ports**
- `5678:5678` - N8N web interface

## 📁 File Structure

```
N8n_node/
├── Dockerfile              # Container definition
├── docker-compose.yml      # Service configuration
├── docker-build.sh         # Build script
├── workflows/              # Example workflows
│   ├── simple-ai-workflow.json
│   └── ai-agent-sqlite-workflow.json
└── n8n-nodes-sqlite-memory-1.0.0.tgz  # Built node package
```

## 🎯 Usage

1. **Access N8N**: http://localhost:5678
2. **Import Workflows**: Use files from `./workflows/` directory
3. **SQLite Memory Node**: Available in Transform section
4. **Database**: Stored in Docker volume `n8n_data`

## 🔍 Troubleshooting

### **Node Not Found**
```bash
# Check if node is installed
docker exec -it n8n-sqlite-memory ls /home/node/.n8n/nodes/node_modules/

# Rebuild container
docker-compose build --no-cache
```

### **Permission Issues**
```bash
# Fix ownership
docker exec -it n8n-sqlite-memory chown -R node:node /home/node/.n8n
```

### **Database Issues**
```bash
# Check SQLite database
docker exec -it n8n-sqlite-memory sqlite3 /home/node/.n8n/n8n-memory.sqlite ".tables"
```

## 🔄 Updates

To update the node:
1. Modify the source code
2. Run `./docker-build.sh`
3. Container will rebuild with latest changes

## 📊 Features

- ✅ **Persistent Storage** - SQLite database in Docker volume
- ✅ **Custom Node** - SQLite Memory pre-installed
- ✅ **Example Workflows** - Ready-to-use AI workflows
- ✅ **Easy Deployment** - One-command setup
- ✅ **Volume Mapping** - Access workflows from host