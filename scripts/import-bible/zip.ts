import { inflateRawSync } from 'node:zlib'

/** Read the pinned ZIP's central directory without invoking a platform unzip binary. */
export function readZip(buffer: Buffer): Map<string, Buffer> {
	let end = buffer.length - 22
	while (end >= Math.max(0, buffer.length - 65557) && buffer.readUInt32LE(end) !== 0x06054b50) end--
	if (end < 0 || buffer.readUInt32LE(end) !== 0x06054b50) throw new Error('Invalid ZIP directory')
	const files = new Map<string, Buffer>()
	let position = buffer.readUInt32LE(end + 16)
	for (let index = 0; index < buffer.readUInt16LE(end + 10); index++) {
		if (buffer.readUInt32LE(position) !== 0x02014b50) throw new Error('Invalid ZIP entry')
		const method = buffer.readUInt16LE(position + 10)
		const size = buffer.readUInt32LE(position + 20)
		const nameLength = buffer.readUInt16LE(position + 28)
		const name = buffer.subarray(position + 46, position + 46 + nameLength).toString('utf8')
		const local = buffer.readUInt32LE(position + 42)
		const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28)
		const data = buffer.subarray(start, start + size)
		if (method !== 0 && method !== 8) throw new Error(`Unsupported ZIP method ${method}`)
		files.set(name, method === 8 ? inflateRawSync(data) : data)
		position +=
			46 + nameLength + buffer.readUInt16LE(position + 30) + buffer.readUInt16LE(position + 32)
	}
	return files
}
