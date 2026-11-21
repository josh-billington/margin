import { CapacitorSQLite } from '@capacitor-community/sqlite'
import { z } from 'zod'
import type { OpenDatabase } from '@margin/services/ports'

const byteArray = z.array(z.number().int().min(0).max(255))
const rowSchema = z.record(z.string(), z.unknown())

function nativeRow(row: unknown): unknown {
	return Object.fromEntries(
		Object.entries(rowSchema.parse(row)).map(([column, value]) => [
			column,
			Array.isArray(value) ? Uint8Array.from(byteArray.parse(value)) : value,
		]),
	)
}

export function createOpenDatabase(): OpenDatabase {
	let copied: Promise<void> | undefined
	return async (corpus) => {
		await (copied ??= CapacitorSQLite.copyFromAssets({ overwrite: true }).catch(
			(error: unknown) => {
				copied = undefined
				throw error
			},
		))
		const database = `margin-${corpus}`
		const options = { database, readonly: true }
		await CapacitorSQLite.createConnection({
			...options,
			encrypted: false,
			mode: 'no-encryption',
			version: 1,
		})
		try {
			await CapacitorSQLite.open(options)
		} catch (error) {
			await CapacitorSQLite.closeConnection(options)
			throw error
		}
		const all = async (
			sql: string,
			params: readonly unknown[] = [],
		): Promise<readonly unknown[]> => {
			const result = await CapacitorSQLite.query({
				...options,
				statement: sql,
				values: [...params],
			})
			const rows: readonly unknown[] = result.values ?? []
			return rows.filter((row) => !('ios_columns' in rowSchema.parse(row))).map(nativeRow)
		}
		return {
			all,
			get: async (sql, params) => (await all(sql, params))[0],
			userVersion: async () =>
				z.number().parse((await CapacitorSQLite.getVersion(options)).version),
			close: () => CapacitorSQLite.closeConnection(options),
		}
	}
}
