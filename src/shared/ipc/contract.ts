import { z } from 'zod'
import {
	strongIdSchema,
	lexiconEntrySchema,
	lookupRequestSchema,
	lookupResultSchema,
} from '../lexicon/types'
import type { AppCommandId } from './commands'
import {
	passageRangeSchema,
	verseRefSchema,
	passageTextSchema,
	textEditionSchema,
	translationIdSchema,
} from '../bible/types'
import { insertionPreviewSchema } from '../bible/reference'
import {
	paletteColorSchema,
	studyFileEnvelopeSchema,
	studyMetadataSchema,
	ulidSchema,
} from '../study/types'

export const ipcErrorSchema = z.object({
	code: z.enum([
		'NOT_IMPLEMENTED',
		'INVALID_REQUEST',
		'FORBIDDEN',
		'INTERNAL_ERROR',
		'SAVE_FAILED',
	]),
	message: z.string(),
})
export type IpcError = z.infer<typeof ipcErrorSchema>
export const resultSchema = <T extends z.ZodType>(data: T) =>
	z.discriminatedUnion('ok', [
		z.object({ ok: z.literal(true), data }),
		z.object({ ok: z.literal(false), error: ipcErrorSchema }),
	])
export const appearanceSchema = z.enum(['system', 'light', 'dark'])
export type Appearance = z.infer<typeof appearanceSchema>
export const preferencesSchema = z.object({
	defaultTranslation: translationIdSchema,
	oldTestamentTranslation: translationIdSchema,
	defaultNoteFont: z.enum(['handwritten', 'plain']),
	displayNotesInPlainFont: z.boolean(),
	/** Native Liquid Glass / vibrancy on the title bar and sidebar. Applied at launch; on unless false. */
	liquidGlass: z.boolean().optional(),
	/** Window appearance. Follows the system unless set; applied live. */
	appearance: appearanceSchema.optional(),
	/** Colour new plain highlights get in Highlight mode; amber unless set. */
	highlightColor: paletteColorSchema.optional(),
	/** The study to reopen on the next launch. */
	lastOpenedStudyId: ulidSchema.optional(),
})
export type Preferences = z.infer<typeof preferencesSchema>
export const cameraSchema = z.object({
	x: z.number().finite(),
	y: z.number().finite(),
	z: z.number().min(0.1).max(4),
})
export type Camera = z.infer<typeof cameraSchema>
export const mappedPassageSchema = z.object({
	kind: z.enum(['mapped', 'confirmation-required', 'incomplete']),
	translation: translationIdSchema,
	ranges: z.array(passageRangeSchema),
	unmapped: z.array(z.object({ ref: verseRefSchema, reason: z.string() })),
	partialGroups: z.array(
		z.object({ source: z.array(verseRefSchema), target: z.array(verseRefSchema) }),
	),
})
export type MappedPassage = z.infer<typeof mappedPassageSchema>
const studyIdRequest = z.object({ studyId: ulidSchema })
export const lockNoticeSchema = z.object({
	host: z.string().min(1),
	since: z.string().nullable(),
})
export type LockNotice = z.infer<typeof lockNoticeSchema>
const librarySchema = z.object({
	path: z.string().min(1),
	displayPath: z.string().min(1),
	setup: z.enum(['pending', 'done']),
	readOnly: z.boolean(),
	/** Set only when another computer holds the library lock. */
	lock: lockNoticeSchema.nullable(),
})
export const studySummarySchema = studyMetadataSchema.pick({
	id: true,
	title: true,
	updatedAt: true,
})
const operation = <const C extends string, I extends z.ZodType, O extends z.ZodType>(
	channel: C,
	request: I,
	data: O,
) => ({
	channel,
	request,
	response: resultSchema(data),
})

export const ipcContract = {
	library: {
		getLibrary: operation('margin:library:get', z.void(), librarySchema.nullable()),
		completeSetup: operation('margin:library:complete-setup', z.void(), librarySchema),
		chooseLibraryFolder: operation(
			'margin:library:choose-folder',
			z.void(),
			librarySchema.nullable(),
		),
		createStudy: operation(
			'margin:library:create-study',
			z.object({
				title: z.string().trim().min(1),
				document: studyFileEnvelopeSchema.shape.document,
			}),
			studyFileEnvelopeSchema,
		),
		listStudies: operation('margin:library:list-studies', z.void(), z.array(studySummarySchema)),
		openStudy: operation('margin:library:open-study', studyIdRequest, studyFileEnvelopeSchema),
		saveStudy: operation(
			'margin:library:save-study',
			z.object({
				study: studyFileEnvelopeSchema,
				sequence: z.number().int().nonnegative(),
				base: z.string(),
			}),
			z.object({ study: studyFileEnvelopeSchema, conflict: z.boolean() }),
		),
		closeStudy: operation('margin:library:close-study', studyIdRequest, z.null()),
		stageStudy: operation(
			'margin:library:stage',
			z.object({ study: studyFileEnvelopeSchema, sequence: z.number().int().nonnegative() }),
			z.null(),
		),
		flush: operation('margin:library:flush', z.void(), z.null()),
		takeOver: operation('margin:library:take-over', z.void(), librarySchema),
		deleteStudy: operation('margin:library:delete-study', studyIdRequest, z.null()),
	},
	bible: {
		resolveReference: operation(
			'margin:bible:resolve-reference',
			z.object({
				reference: z.string().trim().min(1),
				translationId: translationIdSchema,
				oldTestamentTranslationId: translationIdSchema.optional(),
			}),
			insertionPreviewSchema,
		),
		getPassage: operation(
			'margin:bible:get-passage',
			z.object({ translationId: translationIdSchema, ranges: z.array(passageRangeSchema).min(1) }),
			passageTextSchema,
		),
		mapPassage: operation(
			'margin:bible:map-passage',
			z.object({
				from: translationIdSchema,
				to: translationIdSchema,
				ranges: z.array(passageRangeSchema).min(1),
			}),
			mappedPassageSchema,
		),
		listTranslations: operation(
			'margin:bible:list-translations',
			z.void(),
			z.array(textEditionSchema),
		),
	},
	lexicon: {
		copyEntry: operation('margin:lexicon:copy-entry', z.object({ id: strongIdSchema }), z.null()),
		lookupSelection: operation('margin:lexicon:selection', lookupRequestSchema, lookupResultSchema),
		getEntry: operation(
			'margin:lexicon:entry',
			z.object({ id: strongIdSchema }),
			lexiconEntrySchema.nullable(),
		),
		contextMenu: operation(
			'margin:lexicon:context-menu',
			z.object({ word: z.string().max(500), multiple: z.boolean() }),
			z.null(),
		),
	},
	prefs: {
		get: operation('margin:prefs:get', z.void(), preferencesSchema),
		set: operation('margin:prefs:set', preferencesSchema.partial(), preferencesSchema),
	},
	camera: {
		get: operation('margin:camera:get', studyIdRequest, cameraSchema.nullable()),
		set: operation(
			'margin:camera:set',
			z.object({ studyId: ulidSchema, camera: cameraSchema }),
			z.null(),
		),
	},
}

type ContractApi<C> = {
	[G in keyof C]: {
		[M in keyof C[G]]: C[G][M] extends {
			request: infer I extends z.ZodType
			response: infer O extends z.ZodType
		}
			? (request: z.input<I>) => Promise<z.output<O>>
			: never
	}
}
export const libraryEventSchema = z.discriminatedUnion('kind', [
	z.object({ kind: z.literal('reload'), study: studyFileEnvelopeSchema }),
	z.object({ kind: z.literal('conflict'), study: studyFileEnvelopeSchema, originalId: ulidSchema }),
	z.object({ kind: z.literal('recovery'), study: studyFileEnvelopeSchema }),
	z.object({ kind: z.literal('deleted'), studyId: ulidSchema }),
	z.object({ kind: z.literal('error'), studyId: z.string(), message: z.string() }),
	z.object({ kind: z.literal('list') }),
])
export type LibraryEvent = z.infer<typeof libraryEventSchema>
export type StudySummary = z.infer<typeof studySummarySchema>
export const glassModeSchema = z.enum(['native', 'vibrancy', 'none'])
export type GlassMode = z.infer<typeof glassModeSchema>
export const resolvedAppearanceSchema = z.enum(['light', 'dark'])
export type ResolvedAppearance = z.infer<typeof resolvedAppearanceSchema>
export const APPEARANCE_CHANNEL = 'margin:appearance'
export const APPEARANCE_ARGUMENT = '--margin-appearance='
export const GLASS_CHANNEL = 'margin:glass'
export const GLASS_ARGUMENT = '--margin-glass='
export type MarginApi = ContractApi<typeof ipcContract> & {
	/** Window material behind the title bar and sidebar: the mode at launch, and later changes. */
	/** The appearance in effect (preference resolved against the system): at launch, and later changes. */
	appearance: {
		mode: ResolvedAppearance
		onChange: (listener: (mode: ResolvedAppearance) => void) => () => void
	}
	glass: { mode: GlassMode; onChange: (listener: (mode: GlassMode) => void) => () => void }
	events: {
		onLibrary: (listener: (event: LibraryEvent) => void) => () => void
		onFlush: (listener: () => Promise<boolean>) => () => void
		onCommand: (listener: (id: AppCommandId) => void) => () => void
	}
}
