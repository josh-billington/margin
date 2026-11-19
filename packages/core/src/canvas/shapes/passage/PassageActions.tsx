import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useRef } from 'react'
import { ChevronRight, Ellipsis } from 'lucide-react'
import type { Editor } from 'tldraw'
import { captureTextSelection } from '../../highlights/tagging'
import { activeVerse, focusPassage, focusVerse, pullOutVerse } from '../../focus/actions'
import { verseKey } from '../../highlights/ranges'
import { blockNoun, blockTitle } from '../../../insertion/labels'
import type { PassageShape } from '../types'
import { iconLg, iconSm } from '../../../lib/icons'

/**
 * The block's single header menu (SPEC §6.2): focus and pull-out actions, plus the options panel.
 * Verse actions stay reachable when verse numbers are hidden.
 */
export function PassageActions({
	editor,
	shape,
	onOptions,
}: {
	editor: Editor
	shape: PassageShape
	onOptions: () => void
}) {
	const verses = shape.props.text.verses
	const noun = blockNoun(shape.props.text.ranges, shape.props.text.edition.translationId)
	const title = blockTitle(shape.props.text.ranges, shape.props.text.edition.translationId)
	const readOnly = editor.getIsReadonly()
	/** Set by "Options…"; the panel opens once the menu has finished closing and released focus. */
	const openOptions = useRef(false)
	const verseItems = (run: (verse: (typeof verses)[number]['ref']) => void) =>
		verses.map((verse) => (
			<DropdownMenu.Item
				key={verseKey(verse.ref)}
				className="margin-menu-item"
				onSelect={() => run(verse.ref)}
			>
				Verse {verse.ref.verse}
			</DropdownMenu.Item>
		))
	return (
		<DropdownMenu.Root>
			<DropdownMenu.Trigger
				className="passage-menu-trigger"
				aria-label={`Actions for ${title}`}
				onPointerDown={(e) => {
					// Keep any word selection so "Tag selected words" in the options panel can use it.
					captureTextSelection(editor)
					e.stopPropagation()
				}}
			>
				<Ellipsis {...iconLg} aria-hidden="true" />
			</DropdownMenu.Trigger>
			<DropdownMenu.Portal>
				<DropdownMenu.Content
					className="margin-menu"
					aria-label={`Actions for ${title}`}
					align="end"
					onPointerDown={(e) => e.stopPropagation()}
					onCloseAutoFocus={(e) => {
						e.preventDefault()
						if (!openOptions.current) return
						openOptions.current = false
						onOptions()
					}}
				>
					<DropdownMenu.Item
						className="margin-menu-item"
						onSelect={() => focusPassage(editor, shape.id)}
					>
						Focus {noun} <kbd>F</kbd>
					</DropdownMenu.Item>
					<DropdownMenu.Sub>
						<DropdownMenu.SubTrigger className="margin-menu-item">
							Focus verse
							<ChevronRight {...iconSm} aria-hidden="true" />
						</DropdownMenu.SubTrigger>
						<DropdownMenu.Portal>
							<DropdownMenu.SubContent className="margin-menu margin-menu-scroll">
								{verseItems((verse) => focusVerse(editor, shape.id, verse))}
							</DropdownMenu.SubContent>
						</DropdownMenu.Portal>
					</DropdownMenu.Sub>
					<DropdownMenu.Sub>
						<DropdownMenu.SubTrigger className="margin-menu-item" disabled={readOnly}>
							Pull out verse
							<ChevronRight {...iconSm} aria-hidden="true" />
						</DropdownMenu.SubTrigger>
						<DropdownMenu.Portal>
							<DropdownMenu.SubContent className="margin-menu margin-menu-scroll">
								{verseItems((verse) => pullOutVerse(editor, shape.id, verse))}
							</DropdownMenu.SubContent>
						</DropdownMenu.Portal>
					</DropdownMenu.Sub>
					{activeVerse(editor, shape.id) && (
						<DropdownMenu.Item
							className="margin-menu-item"
							disabled={readOnly}
							onSelect={() => {
								const verse = activeVerse(editor, shape.id)
								if (verse) pullOutVerse(editor, shape.id, verse)
							}}
						>
							Pull out active verse <kbd>⇧F</kbd>
						</DropdownMenu.Item>
					)}
					<DropdownMenu.Separator className="margin-menu-separator" />
					<DropdownMenu.Item
						className="margin-menu-item"
						onSelect={() => {
							openOptions.current = true
						}}
					>
						Options…
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Portal>
		</DropdownMenu.Root>
	)
}
