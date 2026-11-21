import { inkLabel } from './outline'
import type { Attachment, Outline, OutlineVerse, Search, StudyList } from './schema'

const escape = (text: string) => text.replace(/[\\`*_[\]<>#+|~-]/g, '\\$&')

function renderVerse({ number, text, italicSpans = [] }: OutlineVerse) {
	let markdown = `**${number}** `
	let offset = 0
	for (const { start, end } of italicSpans) {
		markdown += `${escape(text.slice(offset, start))}*${escape(text.slice(start, end))}*`
		offset = end
	}
	return markdown + escape(text.slice(offset))
}

function describeAttachment(attachment: Attachment): string {
	switch (attachment.kind) {
		case 'passage':
			return `attached to ${attachment.reference}`
		case 'verse':
			return `attached to ${attachment.verse}`
		case 'free':
			return attachment.nearest ? `free; nearest passage: ${attachment.nearest.reference}` : 'free'
	}
}

export function outlineMarkdown({ title, blocks, arrows, tags, diagrams }: Outline) {
	const lines = [`# ${escape(title)}`]
	for (const block of blocks) {
		if (block.kind === 'note') {
			lines.push('', `### Note (${escape(describeAttachment(block.attachment))})`, '')
			if (block.text.trim()) lines.push(escape(block.text))
			if (block.handwrittenInk) lines.push(`*${inkLabel}*`)
			if (!block.text.trim() && !block.handwrittenInk) lines.push('*Empty note*')
			continue
		}
		lines.push('', `## ${escape(block.reference)} (${escape(block.translation)})`, '')
		let verseLines: string[] = []
		for (const verse of block.verses) {
			if (verse.paragraphBreakBefore && verseLines.length) {
				lines.push(verseLines.join('  \n'), '')
				verseLines = []
			}
			verseLines.push(renderVerse(verse))
		}
		if (verseLines.length) lines.push(verseLines.join('  \n'))
		if (block.highlights.length)
			lines.push(
				'',
				'**Highlights**',
				'',
				...block.highlights.map(({ quote, reference, style }) => {
					const label = style.kind === 'tag' ? style.tag.name : style.color
					return `- “${escape(quote)}” (${escape(reference)}) — ${escape(label)}`
				}),
			)
	}
	if (!blocks.length) lines.push('', 'No passages or notes.')
	if (arrows.length)
		lines.push('', '## Arrows', '', ...arrows.map(({ description }) => `- ${escape(description)}`))
	if (diagrams) {
		const { shapes, labels } = diagrams
		lines.push(
			'',
			'## Diagrams',
			'',
			`${shapes} ${shapes === 1 ? 'shape' : 'shapes'}, ${labels.length} text ${labels.length === 1 ? 'label' : 'labels'}.`,
		)
		for (const label of labels) lines.push(`- ${escape(label.replace(/\s+/g, ' '))}`)
	}
	if (tags.length)
		lines.push('', '## Tags', '', ...tags.map(({ name, color }) => `- ${escape(name)} (${color})`))
	return lines.join('\n')
}

function addWarnings({ lines, warnings }: { lines: string[]; warnings: StudyList['warnings'] }) {
	if (warnings.length)
		lines.push(
			'',
			'## Unreadable studies',
			'',
			...warnings.map(({ message }) => `- ${escape(message)}`),
		)
	return lines.join('\n')
}

export function listMarkdown({ studies, warnings }: StudyList) {
	const lines = studies.flatMap(({ id, title, updatedAt, passages, counts }) => [
		`- **${escape(title)}** (\`${id}\`), updated ${updatedAt}`,
		`  ${passages.length ? passages.map(escape).join('; ') : 'No passages'}`,
		`  ${counts.highlights} highlights, ${counts.notes} notes, ${counts.arrows} arrows`,
	])
	return addWarnings({
		lines: lines.length ? lines : ['No readable Margin studies found.'],
		warnings,
	})
}

export function searchMarkdown({ studies, warnings }: Search) {
	const lines = studies.flatMap(({ id, title, matches }) => [
		`- **${escape(title)}** (\`${id}\`)`,
		...matches.map(({ field, snippet }) => `  - ${field}: ${escape(snippet)}`),
	])
	return addWarnings({ lines: lines.length ? lines : ['No matching Margin studies.'], warnings })
}
