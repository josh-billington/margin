import type { TranslationId } from './types'

export const translationNames: Record<TranslationId, { short: string; long: string }> = {
	bsb: { short: 'BSB', long: 'Berean Standard Bible' },
	web: { short: 'WEB', long: 'World English Bible' },
	asv: { short: 'ASV', long: 'American Standard Version (1901)' },
	kjv: { short: 'KJV', long: 'King James Version' },
	jps1917: { short: 'JPS 1917', long: 'JPS 1917 (The Holy Scriptures)' },
}
