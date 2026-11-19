import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex } from '@noble/hashes/utils.js'
import { inflateSync } from 'fflate'
import type { Hasher, Codec } from './ports'

export const hasher: Hasher = {
	sha256Hex: (data) =>
		bytesToHex(sha256(typeof data === 'string' ? new TextEncoder().encode(data) : data)),
}
export const codec: Codec = { inflateRaw: (data) => inflateSync(data) }
