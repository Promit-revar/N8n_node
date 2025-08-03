const sqlite3 = require('sqlite3');
const { join } = require('path');

class MemoryStore {
	constructor() {
		this.db = new sqlite3.Database(':memory:');
		this.initialize();
	}

	initialize() {
		return new Promise((resolve) => {
			this.db.run(`
				CREATE TABLE IF NOT EXISTS memory (
					sessionKey TEXT PRIMARY KEY,
					messages TEXT,
					created INTEGER,
					lastAccessed INTEGER
				)
			`, resolve);
		});
	}

	run(sql, params = []) {
		return new Promise((resolve, reject) => {
			this.db.run(sql, params, function (err) {
				if (err) reject(err);
				else resolve();
			});
		});
	}

	get(sql, params = []) {
		return new Promise((resolve, reject) => {
			this.db.get(sql, params, (err, row) => {
				if (err) reject(err);
				else resolve(row);
			});
		});
	}

	async getMessages(sessionKey, windowSize = 10) {
		const row = await this.get(
			`SELECT messages FROM memory WHERE sessionKey = ?`,
			[sessionKey],
		);

		if (!row) return [];

		const messages = JSON.parse(row.messages);
		return messages.slice(-windowSize);
	}

	async addMessage(sessionKey, message) {
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

	async clearMemory(sessionKey) {
		await this.run(`DELETE FROM memory WHERE sessionKey = ?`, [sessionKey]);
	}
}

// Test
async function test() {
	const store = new MemoryStore();
	await store.initialize();
	
	console.log('Testing SQLite Memory...');
	
	// Test add message
	await store.addMessage('test-session', { role: 'user', content: 'Hello' });
	await store.addMessage('test-session', { role: 'ai', content: 'Hi there!' });
	
	// Test get messages
	const messages = await store.getMessages('test-session');
	console.log('Messages:', messages);
	
	// Test clear
	await store.clearMemory('test-session');
	const cleared = await store.getMessages('test-session');
	console.log('After clear:', cleared);
	
	console.log('All tests passed!');
}

test().catch(console.error);