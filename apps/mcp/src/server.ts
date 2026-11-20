import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { libraryErrorMessage, openLibrary } from './library'
import { listMarkdown, outlineMarkdown, searchMarkdown } from './markdown'
import { outlineStudy, searchStudy, summarizeStudy } from './outline'
import { listOutput, outlineOutput, searchOutput, toolIdSchema } from './schema'
import manifest from '../package.json'

const readOnly = {
	readOnlyHint: true,
	destructiveHint: false,
	idempotentHint: true,
	openWorldHint: false,
}

function textResult(text: string): CallToolResult['content'] {
	return [{ type: 'text', text }]
}

function tool(run: () => Promise<CallToolResult>) {
	return run().catch((error) => ({
		isError: true,
		content: textResult(libraryErrorMessage(error)),
	}))
}

export function createServer(path: string) {
	const library = openLibrary(path)
	const server = new McpServer({ name: 'margin', version: manifest.version })
	server.registerTool(
		'list_studies',
		{
			description:
				'List saved Margin Bible studies, newest first, with IDs, references, translations, and annotation counts. Use the ID with get_study. Unreadable studies appear in warnings.',
			annotations: readOnly,
			outputSchema: listOutput,
		},
		() =>
			tool(async () => {
				const { studies, warnings } = await library.readStudies()
				const data = { studies: studies.map(summarizeStudy), warnings }
				return { content: textResult(listMarkdown(data)), structuredContent: data }
			}),
	)
	server.registerTool(
		'get_study',
		{
			description:
				'Read one saved Margin study as a teaching outline. Returns Markdown and structured JSON in canvas reading order, including scripture, quoted highlights, notes, arrows, diagram labels, and tags.',
			annotations: readOnly,
			inputSchema: z.object({
				id: toolIdSchema.describe('Study ID from list_studies or search_studies.'),
				include_italics: z
					.boolean()
					.optional()
					.describe('Mark supplied words in italics (default: true).'),
			}),
			outputSchema: outlineOutput,
		},
		({ id, include_italics: includeItalics = true }) =>
			tool(async () => {
				const study = await library.readStudy(id)
				const data = outlineStudy({ study, includeItalics })
				return { content: textResult(outlineMarkdown(data)), structuredContent: data }
			}),
	)
	server.registerTool(
		'search_studies',
		{
			description:
				'Find saved Margin studies by a case-insensitive literal match in a title, typed note, or scripture reference. Returns study IDs and matching excerpts, not full studies.',
			annotations: readOnly,
			inputSchema: z.object({
				query: z.string().trim().min(1).describe('Text or scripture reference to find.'),
			}),
			outputSchema: searchOutput,
		},
		({ query }) =>
			tool(async () => {
				const { studies, warnings } = await library.readStudies()
				const matches = studies.flatMap((study) => searchStudy({ study, query }) ?? [])
				const data = { studies: matches, warnings }
				return { content: textResult(searchMarkdown(data)), structuredContent: data }
			}),
	)
	return server
}
