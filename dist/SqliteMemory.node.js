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
const uuid_1 = require("uuid");
const tiktoken_1 = require("tiktoken");
class MemoryStore {
    constructor() {
        this.cache = new Map();
        // Use N8N user folder if available (Docker), otherwise current directory
        const baseDir = process.env.N8N_USER_FOLDER || process.cwd();
        const dbPath = (0, path_1.join)(baseDir, 'n8n-memory.sqlite');
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
        try {
            // Create table synchronously
            this.db.exec(`
				CREATE TABLE IF NOT EXISTS memory (
					sessionKey TEXT PRIMARY KEY,
					messages TEXT,
					created INTEGER,
					lastAccessed INTEGER
				)
			`);
            // Table created successfully
        }
        catch (error) {
            // Failed to create table
            throw error;
        }
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
    countTokens(text, model) {
        try {
            const encoder = (0, tiktoken_1.encoding_for_model)(model);
            const tokens = encoder.encode(text);
            encoder.free();
            return tokens.length;
        }
        catch {
            return Math.ceil(text.length / 4); // Fallback estimation
        }
    }
    migrateMessage(msg) {
        if (msg.id)
            return msg; // Already new format
        // Migrate legacy format
        return {
            id: (0, uuid_1.v4)(),
            role: msg.role === 'ai' ? 'assistant' : msg.role,
            content: msg.content,
            timestamp: Date.now(),
        };
    }
    generateSessionKey() {
        return (0, uuid_1.v4)();
    }
    detectUserMessage(input) {
        // Handle array input
        if (Array.isArray(input) && input.length > 0) {
            input = input[0];
        }
        if (typeof input === 'string')
            return input;
        if (input === null || input === void 0 ? void 0 : input.chatInput)
            return input.chatInput;
        if (input === null || input === void 0 ? void 0 : input.message)
            return input.message;
        if (input === null || input === void 0 ? void 0 : input.content)
            return input.content;
        if (input === null || input === void 0 ? void 0 : input.text)
            return input.text;
        if (input === null || input === void 0 ? void 0 : input.query)
            return input.query;
        return null;
    }
    detectAIResponse(input) {
        var _a, _b, _c, _d;
        // OpenAI format
        if ((_c = (_b = (_a = input === null || input === void 0 ? void 0 : input.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content) {
            return {
                content: input.choices[0].message.content,
                metadata: {
                    model: input.model,
                    tokens: (_d = input.usage) === null || _d === void 0 ? void 0 : _d.total_tokens,
                },
            };
        }
        // LangChain format
        if (input === null || input === void 0 ? void 0 : input.output) {
            return { content: input.output, metadata: input.metadata };
        }
        // Simple text response
        if (typeof input === 'string')
            return { content: input };
        if (input === null || input === void 0 ? void 0 : input.content)
            return { content: input.content, metadata: input.metadata };
        return null;
    }
    async getMessages(sessionKey, windowSize = 10) {
        if (this.cache.has(sessionKey)) {
            return this.cache.get(sessionKey).slice(-windowSize);
        }
        const row = await this.get(`SELECT messages FROM memory WHERE sessionKey = ?`, [sessionKey]);
        if (!row)
            return [];
        const rawMessages = JSON.parse(row.messages);
        const messages = rawMessages.map((msg) => this.migrateMessage(msg));
        this.cache.set(sessionKey, messages);
        return messages.slice(-windowSize);
    }
    async addMessage(sessionKey, message) {
        const newMessage = 'id' in message ? message : this.migrateMessage(message);
        const existing = await this.getMessages(sessionKey, 1000);
        existing.push(newMessage);
        const trimmed = existing.slice(-50);
        this.cache.set(sessionKey, trimmed);
        const encoded = JSON.stringify(trimmed);
        const now = Date.now();
        await this.run(`INSERT INTO memory (sessionKey, messages, created, lastAccessed)
			VALUES (?, ?, ?, ?)
			ON CONFLICT(sessionKey) DO UPDATE SET
				messages = excluded.messages,
				lastAccessed = excluded.lastAccessed`, [sessionKey, encoded, now, now]);
    }
    async addMessageWithMetadata(sessionKey, content, role, metadata) {
        const message = {
            id: (0, uuid_1.v4)(),
            role,
            content,
            timestamp: Date.now(),
            metadata,
        };
        await this.addMessage(sessionKey, message);
    }
    async getSmartContext(sessionKey, tokenLimit, model) {
        const messages = await this.getMessages(sessionKey, 100);
        const result = [];
        let totalTokens = 0;
        for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            const tokens = this.countTokens(msg.content, model);
            if (totalTokens + tokens > tokenLimit && result.length > 0)
                break;
            result.unshift(msg);
            totalTokens += tokens;
        }
        return result;
    }
    async formatForAI(sessionKey, tokenLimit, model) {
        const messages = await this.getSmartContext(sessionKey, tokenLimit, model);
        return messages.map(msg => ({
            role: msg.role,
            content: msg.content
        }));
    }
    async clearMemory(sessionKey) {
        this.cache.delete(sessionKey);
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
                            name: 'Add Message',
                            value: 'addMessage',
                            description: 'Add a message to memory',
                            action: 'Add message to memory',
                        },
                        {
                            name: 'Auto-Store AI Response',
                            value: 'autoStoreAI',
                            description: 'Automatically store AI response with metadata',
                            action: 'Auto store AI response',
                        },
                        {
                            name: 'Auto-Store User Input',
                            value: 'autoStoreUser',
                            description: 'Automatically store user input from previous node',
                            action: 'Auto store user input',
                        },
                        {
                            name: 'Clear Memory',
                            value: 'clearMemory',
                            description: 'Clear all messages for a session',
                            action: 'Clear memory for session',
                        },
                        {
                            name: 'Format for AI',
                            value: 'formatForAI',
                            description: 'Format conversation history for AI consumption',
                            action: 'Format conversation for AI',
                        },
                        {
                            name: 'Get Messages',
                            value: 'getMessages',
                            description: 'Retrieve chat messages from memory',
                            action: 'Get messages from memory',
                        },
                        {
                            name: 'Smart Context Window',
                            value: 'smartContext',
                            description: 'Get context-aware message window',
                            action: 'Get smart context window',
                        },
                    ],
                    default: 'getMessages',
                },
                {
                    displayName: 'Session Key',
                    name: 'sessionKey',
                    type: 'string',
                    default: '',
                    placeholder: 'Leave empty for auto-generation',
                    description: 'Session identifier (auto-generated if empty)',
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
                {
                    displayName: 'AI Model',
                    name: 'aiModel',
                    type: 'options',
                    options: [
                        { name: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' },
                        { name: 'GPT-4', value: 'gpt-4' },
                        { name: 'GPT-4 Turbo', value: 'gpt-4-turbo-preview' },
                    ],
                    default: 'gpt-3.5-turbo',
                    description: 'AI model for token counting',
                    displayOptions: {
                        show: {
                            operation: ['formatForAI', 'smartContext'],
                        },
                    },
                },
                {
                    displayName: 'Role',
                    name: 'role',
                    type: 'options',
                    options: [
                        { name: 'User', value: 'user' },
                        { name: 'Assistant', value: 'assistant' },
                        { name: 'System', value: 'system' },
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
                    typeOptions: { rows: 4 },
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
                let sessionKey = this.getNodeParameter('sessionKey', i);
                if (!sessionKey)
                    sessionKey = store.generateSessionKey();
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
                        await store.addMessageWithMetadata(sessionKey, content, role);
                        result = { success: true, sessionKey, message: { role, content } };
                        break;
                    case 'autoStoreUser':
                        const userInput = store.detectUserMessage(items[i].json);
                        if (userInput) {
                            await store.addMessageWithMetadata(sessionKey, userInput, 'user');
                            result = {
                                success: true,
                                sessionKey,
                                message: { role: 'user', content: userInput },
                                chatInput: userInput
                            };
                        }
                        else {
                            result = { success: false, error: 'No user input detected' };
                        }
                        break;
                    case 'autoStoreAI':
                        const aiResponse = store.detectAIResponse(items[i].json);
                        if (aiResponse) {
                            await store.addMessageWithMetadata(sessionKey, aiResponse.content, 'assistant', aiResponse.metadata);
                            result = { success: true, sessionKey, message: { role: 'assistant', content: aiResponse.content, metadata: aiResponse.metadata } };
                        }
                        else {
                            result = { success: false, error: 'No AI response detected' };
                        }
                        break;
                    case 'formatForAI':
                        const tokenLimit = this.getNodeParameter('tokenLimit', i);
                        const aiModel = this.getNodeParameter('aiModel', i);
                        const formatted = await store.formatForAI(sessionKey, tokenLimit, aiModel);
                        result = { messages: formatted, sessionKey, tokenLimit, model: aiModel };
                        break;
                    case 'smartContext':
                        const contextTokenLimit = this.getNodeParameter('tokenLimit', i);
                        const contextModel = this.getNodeParameter('aiModel', i);
                        const contextMessages = await store.getSmartContext(sessionKey, contextTokenLimit, contextModel);
                        result = { messages: contextMessages, sessionKey, count: contextMessages.length, tokenLimit: contextTokenLimit };
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
