import { defineEndpoint } from '@directus/extensions-sdk';

const WRITE_KEYWORDS = [
	'INSERT',
	'UPDATE',
	'DELETE',
	'DROP',
	'TRUNCATE',
	'ALTER',
	'CREATE',
	'MERGE',
	'GRANT',
	'REVOKE',
	'CALL',
	'EXEC',
	'EXECUTE',
];

type Database = {
	raw: (sql: string) => Promise<unknown>;
};

type EndpointContext = {
	database?: Database;
	services?: {
		database?: Database;
	};
};

/**
 * Removes comments and quoted literals so keyword checks ignore text and identifiers.
 *
 * @param query - SQL to inspect.
 * @returns SQL with comments and quotes replaced by spaces.
 */
function sanitizeForCheck(query: string): string {
	let out = '';
	let index = 0;

	while (index < query.length) {
		if (query.startsWith('--', index)) {
			const newline = query.indexOf('\n', index);
			index = newline === -1 ? query.length : newline;
			continue;
		}

		if (query.startsWith('/*', index)) {
			const commentEnd = query.indexOf('*/', index + 2);
			if (commentEnd === -1) throw new Error('Unclosed block comment');
			index = commentEnd + 2;
			continue;
		}

		const quote = query[index];
		if (quote === "'" || quote === '"' || quote === '`') {
			index += 1;
			while (index < query.length) {
				if (query[index] === '\\') {
					index += 2;
					continue;
				}
				if (query[index] === quote) {
					if (query[index + 1] === quote) {
						index += 2;
						continue;
					}
					index += 1;
					break;
				}
				index += 1;
			}
			out += ' ';
			continue;
		}

		out += query[index];
		index += 1;
	}

	return out;
}

/**
 * Allows a single read-only SELECT, including WITH ... SELECT.
 * The returned SQL is the trimmed statement, with one trailing semicolon removed.
 *
 * @param query - Raw SQL from the panel.
 * @returns The statement to execute.
 */
function assertReadQuery(query: string): string {
	const sql = query.trim().replace(/;\s*$/, '').trim();
	if (!sql) throw new Error('SQL query is required');

	const sanitized = sanitizeForCheck(sql).trim();
	if (!sanitized) throw new Error('SQL query is required');

	if (sanitized.includes(';')) {
		throw new Error('Only a single SELECT statement is allowed');
	}

	const start = sanitized.toUpperCase().match(/^[A-Z]+/)?.[0] ?? '';
	if (start !== 'SELECT' && start !== 'WITH') {
		throw new Error('Only SELECT queries are allowed');
	}

	const upper = sanitized.toUpperCase();
	for (const keyword of WRITE_KEYWORDS) {
		if (new RegExp(`\\b${keyword}\\b`).test(upper)) {
			throw new Error(`Query cannot include ${keyword}. Only SELECT queries are allowed.`);
		}
	}

	if (/\bINTO\s+(OUTFILE|DUMPFILE)\b/.test(upper)) {
		throw new Error('Only SELECT queries are allowed');
	}

	return sql;
}

/**
 * Normalizes Knex raw results from MySQL, PostgreSQL, SQLite, and MSSQL.
 *
 * @param result - Value returned by `database.raw()`.
 * @returns Row objects, or an empty list when the driver shape is unrecognized.
 */
function extractRows(result: unknown): Record<string, unknown>[] {
	if (!result) return [];

	if (Array.isArray(result)) {
		const [first] = result;
		if (Array.isArray(first)) return first as Record<string, unknown>[];
		return result as Record<string, unknown>[];
	}

	if (typeof result === 'object') {
		const record = result as { rows?: unknown; recordset?: unknown };
		if (Array.isArray(record.rows)) return record.rows as Record<string, unknown>[];
		if (Array.isArray(record.recordset)) return record.recordset as Record<string, unknown>[];
	}

	return [];
}

/**
 * Reads the first column of a driver row.
 *
 * @param row - A result row as an object or array.
 * @returns The first cell, or `undefined` when the row is empty.
 */
function readFirstValue(row: unknown): unknown {
	if (Array.isArray(row)) return row[0];
	if (!row || typeof row !== 'object') return undefined;

	const [key] = Object.keys(row);
	if (key === undefined) return undefined;
	return (row as Record<string, unknown>)[key];
}

/**
 * Converts a SQL cell into a finite number.
 *
 * @param value - Cell value from the database driver.
 * @returns The numeric value, or `null` when it cannot be parsed.
 */
function parseNumeric(value: unknown): number | null {
	if (typeof value === 'number') return Number.isFinite(value) ? value : null;
	if (typeof value === 'bigint') {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	}
	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (!trimmed) return null;
		const parsed = Number(trimmed);
		return Number.isFinite(parsed) ? parsed : null;
	}
	if (value && typeof value === 'object' && 'valueOf' in value) {
		const primitive = (value as { valueOf: () => unknown }).valueOf();
		if (primitive !== value) return parseNumeric(primitive);
	}
	return null;
}

export default defineEndpoint((router, context) => {
	router.post('/', async (req, res) => {
		const query = req.body?.query;

		if (!query || typeof query !== 'string') {
			return res.status(400).json({ error: 'SQL query is required' });
		}

		let sql: string;
		try {
			sql = assertReadQuery(query);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Only SELECT queries are allowed';
			return res.status(400).json({ error: message });
		}

		const endpointContext = context as EndpointContext;
		const database = endpointContext.database ?? endpointContext.services?.database;

		if (!database) {
			return res.status(500).json({ error: 'Database service not available' });
		}

		try {
			const result = await database.raw(sql);
			const rows = extractRows(result);

			if (rows.length === 0) {
				return res.status(400).json({ error: 'Query returned no rows' });
			}

			const value = parseNumeric(readFirstValue(rows[0]));
			if (value === null) {
				return res.status(400).json({
					error: 'The first column of the first row must be a number',
				});
			}

			return res.json({ value });
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Error executing query';
			return res.status(500).json({
				error: 'Error executing query',
				message,
			});
		}
	});
});
