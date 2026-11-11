import { open, rename, rm, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'

export async function atomicWrite(path: string, content: string) {
	await mkdir(dirname(path), { recursive: true })
	const temporary = join(dirname(path), `.${randomUUID()}.tmp`)
	try {
		const file = await open(temporary, 'wx', 0o600)
		try {
			await file.writeFile(content, 'utf8')
			await file.sync()
		} finally {
			await file.close()
		}
		await rename(temporary, path)
		const directory = await open(dirname(path), 'r')
		try {
			await directory.sync()
		} finally {
			await directory.close()
		}
	} finally {
		await rm(temporary, { force: true })
	}
}
