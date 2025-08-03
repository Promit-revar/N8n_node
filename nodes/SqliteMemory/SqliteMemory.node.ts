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

type Message = { role: 'user' | 'ai'; content: string };

class MemoryStore {
	private static instance: MemoryStore;
	private db: sqlite3.Database;

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
		this.db.run(`
			CREATE TABLE IF NOT EXISTS memory (
				sessionKey TEXT PRIMARY KEY,
				messages TEXT,
				created INTEGER,
				lastAccessed INTEGER
			)
		`);
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

	async getMessages(sessionKey: string, windowSize = 10): Promise<Message[]> {
		const row = await this.get<{ messages: string }>(
			`SELECT messages FROM memory WHERE sessionKey = ?`,
			[sessionKey],
		);

		if (!row) return [];

		const messages: Message[] = JSON.parse(row.messages);
		return messages.slice(-windowSize);
	}

	async addMessage(sessionKey: string, message: Message) {
		const existing = await this.getMessages(sessionKey, 1000);
		existing.push(message);

		const trimmed = existing.slice(-50);
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

	async clearMemory(sessionKey: string) {
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

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const store = MemoryStore.getInstance();

		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;
				const sessionKey = this.getNodeParameter('sessionKey', i) as string;

				let result: any = {};

				switch (operation) {
					case 'getMessages':
						const windowSize = this.getNodeParameter('windowSize', i) as number;
						const messages = await store.getMessages(sessionKey, windowSize);
						result = { messages, sessionKey, count: messages.length };
						break;

					case 'addMessage':
						const role = this.getNodeParameter('role', i) as 'user' | 'ai';
						const content = this.getNodeParameter('content', i) as string;
						await store.addMessage(sessionKey, { role, content });
						result = { success: true, sessionKey, message: { role, content } };
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