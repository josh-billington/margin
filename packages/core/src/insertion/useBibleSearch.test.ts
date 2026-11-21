// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import type { BibleSearchPage, BibleSearchRequest } from '@shared/bible/search'
import { useBibleSearch } from './useBibleSearch'

afterEach(() => vi.unstubAllGlobals())

const hit = (verse: number) => ({
	ref: { book: 'GEN' as const, chapter: 1, verse },
	translationId: 'kjv' as const,
	text: `Verse ${verse}`,
	matches: [],
})
function page(from: number, length: number, next: number | null, first = false): BibleSearchPage {
	return {
		hits: Array.from({ length }, (_, index) => hit(from + index)),
		next,
		counts: first ? { total: 7, books: [{ book: 'GEN', total: 7 }] } : null,
	}
}
function deferred<T>() {
	let resolve!: (value: T) => void
	const promise = new Promise<T>((done) => (resolve = done))
	return { promise, resolve }
}

async function mount() {
	const requests: { request: BibleSearchRequest; reply: ReturnType<typeof deferred> }[] = []
	const search = vi.fn((request: BibleSearchRequest) => {
		const reply = deferred<unknown>()
		requests.push({ request, reply })
		return reply.promise
	})
	vi.stubGlobal('window', { margin: { bible: { search } } })
	vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
	const latest: { current?: ReturnType<typeof useBibleSearch> } = {}
	function Probe({ query }: { query: string }) {
		latest.current = useBibleSearch({
			query,
			edition: 'kjv',
			translation: 'kjv',
			scope: 'all',
			delay: 0,
		})
		return null
	}
	const root = createRoot(document.createElement('div'))
	const render = (query: string) => act(async () => root.render(createElement(Probe, { query })))
	const answer = async (index: number, value: unknown) => {
		await act(async () => {
			requests[index]?.reply.resolve(value)
			await new Promise((done) => setTimeout(done))
		})
	}
	const settle = () => act(() => new Promise((done) => setTimeout(done)))
	const list = () => {
		const state = latest.current?.state
		return state?.kind === 'ready' ? state.list : undefined
	}
	return {
		requests,
		search,
		latest,
		render,
		answer,
		settle,
		list,
		unmount: () => act(() => root.unmount()),
	}
}

it('appends later pages one request at a time', async () => {
	const probe = await mount()
	try {
		await probe.render('the')
		await probe.settle()
		await probe.answer(0, { ok: true, data: page(1, 3, 3, true) })
		expect(probe.list()?.hits.map(({ ref }) => ref.verse)).toEqual([1, 2, 3])
		act(() => {
			probe.latest.current?.loadMore()
			probe.latest.current?.loadMore()
		})
		expect(probe.search).toHaveBeenCalledTimes(2)
		expect(probe.requests[1]?.request.after).toBe(3)
		expect(probe.list()?.more).toBe('loading')
		await probe.answer(1, { ok: true, data: page(4, 3, 6) })
		await probe.answer(1, { ok: true, data: page(4, 3, 6) })
		expect(probe.list()?.hits.map(({ ref }) => ref.verse)).toEqual([1, 2, 3, 4, 5, 6])
		expect(probe.list()?.counts.total).toBe(7)
		act(() => probe.latest.current?.loadMore())
		await probe.answer(2, { ok: true, data: page(7, 1, null) })
		expect(probe.list()).toMatchObject({ next: null, more: 'idle' })
		act(() => probe.latest.current?.loadMore())
		expect(probe.search).toHaveBeenCalledTimes(3)
	} finally {
		await probe.unmount()
	}
})

it('drops a page that returns after the query changed', async () => {
	const probe = await mount()
	try {
		await probe.render('the')
		await probe.settle()
		await probe.answer(0, { ok: true, data: page(1, 3, 3, true) })
		act(() => probe.latest.current?.loadMore())
		await probe.render('lord')
		await probe.settle()
		await probe.answer(2, { ok: true, data: page(20, 2, null, true) })
		await probe.answer(1, { ok: true, data: page(4, 3, 6) })
		expect(probe.list()?.hits.map(({ ref }) => ref.verse)).toEqual([20, 21])
	} finally {
		await probe.unmount()
	}
})

it('keeps the loaded rows when a later page fails, and retries it', async () => {
	const probe = await mount()
	try {
		await probe.render('the')
		await probe.settle()
		await probe.answer(0, { ok: true, data: page(1, 3, 3, true) })
		act(() => probe.latest.current?.loadMore())
		await probe.answer(1, { ok: false, error: { code: 'X', message: 'Failed' } })
		expect(probe.list()).toMatchObject({ more: 'error', next: 3 })
		expect(probe.list()?.hits).toHaveLength(3)
		act(() => probe.latest.current?.loadMore())
		expect(probe.requests[2]?.request.after).toBe(3)
		await probe.answer(2, { ok: true, data: page(4, 4, null) })
		expect(probe.list()?.hits).toHaveLength(7)
	} finally {
		await probe.unmount()
	}
})
