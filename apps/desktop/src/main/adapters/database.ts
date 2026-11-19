import Sqlite from 'better-sqlite3'
import { z } from 'zod'
import type { Database } from '@margin/services/ports'

export function openDatabase(path: string): Database {
	const db = new Sqlite(path, { readonly: true, fileMustExist: true })
	return {
		get: async (sql, params = []) => db.prepare(sql).get(...params),
		all: async (sql, params = []) => db.prepare(sql).all(...params),
		userVersion: async () => z.number().parse(db.pragma('user_version', { simple: true })),
		close: async () => {
			db.close()
		},
	}
}
