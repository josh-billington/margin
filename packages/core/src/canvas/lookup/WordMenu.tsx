import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useEditor } from 'tldraw'
import type { Editor } from 'tldraw'
import { toast } from 'sonner'
import type { WordTarget } from '@shared/study/types'
import { verseKey } from '../highlights/ranges'
import type { TagRequest } from '../highlights/tagging'
import { requestWordLookup, useLookup } from './store'
import type { WordMenu as WordMenuState } from './store'

const wordElement = (editor: Editor, passageId: string, target: WordTarget) =>
	editor
		.getContainer()
		.querySelector<HTMLElement>(
			`[data-word][data-passage-id="${passageId}"][data-verse-ref="${verseKey(target.verse)}"][data-token-index="${target.token}"]`,
		)

/** The words a request covers, first to last in reading order. */
function requestWords(editor: Editor, request: TagRequest) {
	const start = wordElement(editor, request.passageId, request.start),
		end = wordElement(editor, request.passageId, request.end)
	if (!start || !end) return null
	return start.compareDocumentPosition(end) & Node.DOCUMENT_POSITION_PRECEDING
		? { first: end, last: start }
		: { first: start, last: end }
}

/** Copies the request's words the way ⌘C copies a selection of them: as scripture with its reference. */
function copyWords(editor: Editor, request: TagRequest) {
	const words = requestWords(editor, request)
	const selection = window.getSelection()
	if (!words || !selection) return
	const previous = Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i))
	const range = document.createRange()
	range.setStartBefore(words.first)
	range.setEndAfter(words.last)
	selection.removeAllRanges()
	selection.addRange(range)
	// The passage's own copy handler formats it (PassageComponent onCopy).
	const copied = document.execCommand('copy')
	selection.removeAllRanges()
	for (const kept of previous) selection.addRange(kept)
	if (!copied) toast.error('Margin couldn’t copy.')
}

export function WordMenuOverlay() {
	const editor = useEditor()
	const menu = useLookup((state) => (state.editor === editor ? state.menu : null))
	return menu ? <WordMenu key={JSON.stringify(menu.request)} editor={editor} menu={menu} /> : null
}

/**
 * Look up and copy for a word, where the host has no native context menu: a finger's long-press
 * or a trackpad's secondary click. It points at the words from above, clear of the finger.
 */
function WordMenu({ editor, menu }: { editor: Editor; menu: WordMenuState }) {
	const [anchor] = useState(() => {
		const words = requestWords(editor, menu.request)
		const first = words?.first.getBoundingClientRect(),
			last = words?.last.getBoundingClientRect()
		if (!first || !last) return { left: menu.request.x, top: menu.request.y, width: 0, height: 0 }
		const left = Math.min(first.left, last.left),
			top = Math.min(first.top, last.top)
		return {
			left,
			top,
			width: Math.max(first.right, last.right) - left,
			height: Math.max(first.bottom, last.bottom) - top,
		}
	})
	// Run the choice once the menu has let go of focus, so the lookup popover opens into a calm page.
	const afterClose = useRef<(() => void) | null>(null)
	const close = () => {
		if (useLookup.getState().menu === menu) useLookup.setState({ menu: null })
	}
	return createPortal(
		<DropdownMenu.Root open onOpenChange={(open) => !open && close()}>
			<DropdownMenu.Trigger asChild>
				<span aria-hidden="true" className="word-menu-anchor" style={anchor} />
			</DropdownMenu.Trigger>
			<DropdownMenu.Portal>
				<DropdownMenu.Content
					className="margin-menu word-menu"
					side="top"
					sideOffset={8}
					collisionPadding={8}
					onPointerDown={(event) => event.stopPropagation()}
					onCloseAutoFocus={(event) => {
						event.preventDefault()
						const action = afterClose.current
						afterClose.current = null
						if (action) requestAnimationFrame(action)
					}}
				>
					<DropdownMenu.Item
						className="margin-menu-item"
						onSelect={() => {
							afterClose.current = () => {
								useLookup.setState({ captured: menu.request })
								requestWordLookup(editor)
							}
						}}
					>
						{menu.word ? `Look up “${menu.word}”` : 'Look up selection'}
					</DropdownMenu.Item>
					<DropdownMenu.Separator className="margin-menu-separator" />
					<DropdownMenu.Item
						className="margin-menu-item"
						onSelect={() => copyWords(editor, menu.request)}
					>
						Copy
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Portal>
		</DropdownMenu.Root>,
		document.body,
	)
}
