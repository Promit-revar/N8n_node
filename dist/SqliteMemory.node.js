"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SqliteMemory = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const sqlite3 = __importStar(require("sqlite3"));
const path_1 = require("path");
class MemoryStore {
    constructor() {
        const dbPath = (0, path_1.join)(process.cwd(), 'n8n-memory.sqlite');
        this.db = new sqlite3.Database(dbPath);
        this.initialize();
    }
    static getInstance() {
        if (!MemoryStore.instance) {
            MemoryStore.instance = new MemoryStore();
        }
        return MemoryStore.instance;
    }
    initialize() {
        this.db.run(`
			CREATE TABLE IF NOT EXISTS memory (
				sessionKey TEXT PRIMARY KEY,
				messages TEXT,
				created INTEGER,
				lastAccessed INTEGER
			)
		`);
    }
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function (err) {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err)
                    reject(err);
                else
                    resolve(row);
            });
        });
    }
    async getMessages(sessionKey, windowSize = 10) {
        const row = await this.get(`SELECT messages FROM memory WHERE sessionKey = ?`, [sessionKey]);
        if (!row)
            return [];
        const messages = JSON.parse(row.messages);
        return messages.slice(-windowSize);
    }
    async addMessage(sessionKey, message) {
        const existing = await this.getMessages(sessionKey, 1000);
        existing.push(message);
        const trimmed = existing.slice(-50);
        const encoded = JSON.stringify(trimmed);
        const now = Date.now();
        await this.run(`INSERT INTO memory (sessionKey, messages, created, lastAccessed)
			VALUES (?, ?, ?, ?)
			ON CONFLICT(sessionKey) DO UPDATE SET
				messages = excluded.messages,
				lastAccessed = excluded.lastAccessed`, [sessionKey, encoded, now, now]);
    }
    async clearMemory(sessionKey) {
        await this.run(`DELETE FROM memory WHERE sessionKey = ?`, [sessionKey]);
    }
}
class SqliteMemory {
    constructor() {
        this.description = {
            displayName: 'SQLite Memory',
            name: 'sqliteMemory',
            icon: 'file:sqliteMemory.svg',
            group: ['transform'],
            version: 1,
            description: 'AI Chat Memory with SQLite3 backend',
            defaults: {
                name: 'SQLite Memory',
            },
            inputs: ['main'],
            outputs: ['main'],
            properties: [
                {
                    displayName: 'Operation',
                    name: 'operation',
                    type: 'options',
                    noDataExpression: true,
                    options: [
                        {
                            name: 'Get Messages',
                            value: 'getMessages',
                            description: 'Retrieve chat messages from memory',
                            action: 'Get messages from memory',
                        },
                        {
                            name: 'Add Message',
                            value: 'addMessage',
                            description: 'Add a message to memory',
                            action: 'Add message to memory',
                        },
                        {
                            name: 'Clear Memory',
                            value: 'clearMemory',
                            description: 'Clear all messages for a session',
                            action: 'Clear memory for session',
                        },
                    ],
                    default: 'getMessages',
                },
                {
                    displayName: 'Session Key',
                    name: 'sessionKey',
                    type: 'string',
                    default: 'default',
                    description: 'Unique identifier for the chat session',
                },
                {
                    displayName: 'Window Size',
                    name: 'windowSize',
                    type: 'number',
                    default: 10,
                    description: 'Number of recent messages to retrieve',
                    displayOptions: {
                        show: {
                            operation: ['getMessages'],
                        },
                    },
                },
                {
                    displayName: 'Role',
                    name: 'role',
                    type: 'options',
                    options: [
                        {
                            name: 'User',
                            value: 'user',
                        },
                        {
                            name: 'AI',
                            value: 'ai',
                        },
                    ],
                    default: 'user',
                    description: 'Role of the message sender',
                    displayOptions: {
                        show: {
                            operation: ['addMessage'],
                        },
                    },
                },
                {
                    displayName: 'Message Content',
                    name: 'content',
                    type: 'string',
                    typeOptions: {
                        rows: 4,
                    },
                    default: '',
                    description: 'The message content to store',
                    displayOptions: {
                        show: {
                            operation: ['addMessage'],
                        },
                    },
                },
            ],
        };
    }
    async execute() {
        const items = this.getInputData();
        const returnData = [];
        const store = MemoryStore.getInstance();
        for (let i = 0; i < items.length; i++) {
            try {
                const operation = this.getNodeParameter('operation', i);
                const sessionKey = this.getNodeParameter('sessionKey', i);
                let result = {};
                switch (operation) {
                    case 'getMessages':
                        const windowSize = this.getNodeParameter('windowSize', i);
                        const messages = await store.getMessages(sessionKey, windowSize);
                        result = { messages, sessionKey, count: messages.length };
                        break;
                    case 'addMessage':
                        const role = this.getNodeParameter('role', i);
                        const content = this.getNodeParameter('content', i);
                        await store.addMessage(sessionKey, { role, content });
                        result = { success: true, sessionKey, message: { role, content } };
                        break;
                    case 'clearMemory':
                        await store.clearMemory(sessionKey);
                        result = { success: true, sessionKey, cleared: true };
                        break;
                    default:
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
                }
                returnData.push({
                    json: result,
                    pairedItem: { item: i },
                });
            }
            catch (error) {
                if (this.continueOnFail()) {
                    returnData.push({
                        json: { error: error.message },
                        pairedItem: { item: i },
                    });
                }
                else {
                    throw error;
                }
            }
        }
        return [returnData];
    }
}
exports.SqliteMemory = SqliteMemory;
