import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import * as sqlite3 from 'sqlite3';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { encoding_for_model } from 'tiktoken';

type Message = {
	id: string;
	role: 'user' | 'assistant' | 'system';
	content: string;
	timestamp: number;
	metadata?: {
		model?: string;
		tokens?: number;
		[key: string]: any;
	};
};

type LegacyMessage = { role: 'user' | 'ai'; content: string };

class MemoryStore {
	private static instance: MemoryStore;
	private db: sqlite3.Database;
	private cache: Map<string, Message[]> = new Map();

	private constructor() {
		const dbPath = join(process.cwd(), 'n8n-memory.sqlite');
		this.db = new sqlite3.Database(dbPath);
		this.initialize();
	}

	static getInstance(): MemoryStore {
		if (!MemoryStore.instance) {
			MemoryStore.instance = new MemoryStore();
		}
		return MemoryStore.instance;
	}

	private initialize() {
		// Create table with basic structure first
		this.db.run(`
			CREATE TABLE IF NOT EXISTS memory (
				sessionKey TEXT PRIMARY KEY,
				messages TEXT,
				created INTEGER,
				lastAccessed INTEGER
			)
		`);
		
		// Add new columns if they don't exist
		this.db.run(`ALTER TABLE memory ADD COLUMN version INTEGER DEFAULT 2`, () => {});
		this.db.run(`ALTER TABLE memory ADD COLUMN messageCount INTEGER DEFAULT 0`, () => {});
		this.db.run(`ALTER TABLE memory ADD COLUMN totalTokens INTEGER DEFAULT 0`, () => {});
		this.db.run(`ALTER TABLE memory ADD COLUMN lastModel TEXT`, () => {});
	}

	private run(sql: string, params: any[] = []): Promise<void> {
		return new Promise((resolve, reject) => {
			this.db.run(sql, params, function (err) {
				if (err) reject(err);
				else resolve();
			});
		});
	}

	private get<T>(sql: string, params: any[] = []): Promise<T | undefined> {
		return new Promise((resolve, reject) => {
			this.db.get(sql, params, (err, row) => {
				if (err) reject(err);
				else resolve(row as T | undefined);
			});
		});
	}

	private countTokens(text: string, model: string): number {
		try {
			const encoder = encoding_for_model(model as any);
			const tokens = encoder.encode(text);
			encoder.free();
			return tokens.length;
		} catch {
			return Math.ceil(text.length / 4); // Fallback estimation
		}
	}

	private migrateMessage(msg: any): Message {
		if (msg.id) return msg as Message; // Already new format
		// Migrate legacy format
		return {
			id: uuidv4(),
			role: msg.role === 'ai' ? 'assistant' : msg.role,
			content: msg.content,
			timestamp: Date.now(),
		};
	}

	generateSessionKey(): string {
		return uuidv4();
	}

	detectUserMessage(input: any): string | null {
		// Handle array input
		if (Array.isArray(input) && input.length > 0) {
			input = input[0];
		}
		
		if (typeof input === 'string') return input;
		if (input?.chatInput) return input.chatInput;
		if (input?.message) return input.message;
		if (input?.content) return input.content;
		if (input?.text) return input.text;
		if (input?.query) return input.query;
		return null;
	}

	detectAIResponse(input: any): { content: string; metadata?: any } | null {
		// OpenAI format
		if (input?.choices?.[0]?.message?.content) {
			return {
				content: input.choices[0].message.content,
				metadata: {
					model: input.model,
					tokens: input.usage?.total_tokens,
				},
			};
		}
		// LangChain format
		if (input?.output) {
			return { content: input.output, metadata: input.metadata };
		}
		// Simple text response
		if (typeof input === 'string') return { content: input };
		if (input?.content) return { content: input.content, metadata: input.metadata };
		return null;
	}

	async getMessages(sessionKey: string, windowSize = 10): Promise<Message[]> {
		if (this.cache.has(sessionKey)) {
			return this.cache.get(sessionKey)!.slice(-windowSize);
		}

		const row = await this.get<{ messages: string }>(
			`SELECT messages FROM memory WHERE sessionKey = ?`,
			[sessionKey],
		);

		if (!row) return [];

		const rawMessages = JSON.parse(row.messages);
		const messages = rawMessages.map((msg: any) => this.migrateMessage(msg));
		this.cache.set(sessionKey, messages);
		return messages.slice(-windowSize);
	}

	async addMessage(sessionKey: string, message: Message | LegacyMessage) {
		const newMessage: Message = 'id' in message ? message : this.migrateMessage(message);
		const existing = await this.getMessages(sessionKey, 1000);
		existing.push(newMessage);

		const trimmed = existing.slice(-50);
		this.cache.set(sessionKey, trimmed);
		const encoded = JSON.stringify(trimmed);
		const now = Date.now();

		await this.run(
			`INSERT INTO memory (sessionKey, messages, created, lastAccessed)
			VALUES (?, ?, ?, ?)
			ON CONFLICT(sessionKey) DO UPDATE SET
				messages = excluded.messages,
				lastAccessed = excluded.lastAccessed`,
			[sessionKey, encoded, now, now],
		);
	}

	async addMessageWithMetadata(sessionKey: string, content: string, role: 'user' | 'assistant' | 'system', metadata?: any) {
		const message: Message = {
			id: uuidv4(),
			role,
			content,
			timestamp: Date.now(),
			metadata,
		};
		await this.addMessage(sessionKey, message);
	}

	async getSmartContext(sessionKey: string, tokenLimit: number, model: string): Promise<Message[]> {
		const messages = await this.getMessages(sessionKey, 100);
		const result: Message[] = [];
		let totalTokens = 0;

		for (let i = messages.length - 1; i >= 0; i--) {
			const msg = messages[i];
			const tokens = this.countTokens(msg.content, model);
			if (totalTokens + tokens > tokenLimit && result.length > 0) break;
			result.unshift(msg);
			totalTokens += tokens;
		}

		return result;
	}

	async formatForAI(sessionKey: string, tokenLimit: number, model: string): Promise<Array<{role: string, content: string}>> {
		const messages = await this.getSmartContext(sessionKey, tokenLimit, model);
		return messages.map(msg => ({
			role: msg.role,
			content: msg.content
		}));
	}

	async clearMemory(sessionKey: string) {
		this.cache.delete(sessionKey);
		await this.run(`DELETE FROM memory WHERE sessionKey = ?`, [sessionKey]);
	}
}

export class SqliteMemory implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SQLite Memory',
		name: 'sqliteMemory',
		icon: 'file:sqliteMemory.svg',
		group: ['transform'],
		version: 1,
		description: 'AI Chat Memory with SQLite3 backend',
		defaults: {
			name: 'SQLite Memory',
		},
		inputs: ['main' as NodeConnectionType],
		outputs: ['main' as NodeConnectionType],
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
					{ name: 'Other', value: 'gpt-3.5-turbo' },
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

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const store = MemoryStore.getInstance();

		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;
				let sessionKey = this.getNodeParameter('sessionKey', i) as string;
				if (!sessionKey) sessionKey = store.generateSessionKey();

				let result: any = {};

				switch (operation) {
					case 'getMessages':
						const windowSize = this.getNodeParameter('windowSize', i) as number;
						const messages = await store.getMessages(sessionKey, windowSize);
						result = { messages, sessionKey, count: messages.length };
						break;

					case 'addMessage':
						const role = this.getNodeParameter('role', i) as 'user' | 'assistant' | 'system';
						const content = this.getNodeParameter('content', i) as string;
						await store.addMessageWithMetadata(sessionKey, content, role);
						result = { success: true, sessionKey, message: { role, content } };
						break;

					case 'autoStoreUser':
						const userInput = store.detectUserMessage(items[i].json);
						if (userInput) {
							await store.addMessageWithMetadata(sessionKey, userInput, 'user');
							result = { success: true, sessionKey, message: { role: 'user', content: userInput } };
						} else {
							result = { success: false, error: 'No user input detected' };
						}
						break;

					case 'autoStoreAI':
						const aiResponse = store.detectAIResponse(items[i].json);
						if (aiResponse) {
							await store.addMessageWithMetadata(sessionKey, aiResponse.content, 'assistant', aiResponse.metadata);
							result = { success: true, sessionKey, message: { role: 'assistant', content: aiResponse.content, metadata: aiResponse.metadata } };
						} else {
							result = { success: false, error: 'No AI response detected' };
						}
						break;

					case 'formatForAI':
						const tokenLimit = this.getNodeParameter('tokenLimit', i) as number;
						const aiModel = this.getNodeParameter('aiModel', i) as string;
						const formatted = await store.formatForAI(sessionKey, tokenLimit, aiModel);
						result = { messages: formatted, sessionKey, tokenLimit, model: aiModel };
						break;

					case 'smartContext':
						const contextTokenLimit = this.getNodeParameter('tokenLimit', i) as number;
						const contextModel = this.getNodeParameter('aiModel', i) as string;
						const contextMessages = await store.getSmartContext(sessionKey, contextTokenLimit, contextModel);
						result = { messages: contextMessages, sessionKey, count: contextMessages.length, tokenLimit: contextTokenLimit };
						break;

					case 'clearMemory':
						await store.clearMemory(sessionKey);
						result = { success: true, sessionKey, cleared: true };
						break;

					default:
						throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
				}

				returnData.push({
					json: result,
					pairedItem: { item: i },
				});
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
				} else {
					throw error;
				}
			}
		}

		return [returnData];
	}
}