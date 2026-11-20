import { useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Command } from 'cmdk'
import {
	BookA,
	BookOpen,
	CirclePlay,
	Copy,
	Maximize,
	Moon,
	PanelLeft,
	Plus,
	Redo2,
	Scan,
	Settings,
	Spline,
	Search,
	Sun,
	SunMoon,
	Tag,
	Trash2,
	Undo2,
	ZoomIn,
	ZoomOut,
	type LucideIcon,
} from 'lucide-react'
import { commands, labelFor, runCommand } from './commands'
import type { CommandId } from './commands'
import { useUiStore } from './uiStore'
import { handOff, useDialogMotion } from './dialogMotion'
import { iconMd } from '../lib/icons'
import { platform } from '../lib/platform'

interface CommandPaletteProps {
	open: boolean
	onOpenChange: (open: boolean) => void
}

/** Every listed command has a glyph, so titles line up in one column. */
const icons: Record<Exclude<CommandId, 'palette.toggle'>, LucideIcon> = {
	'passage.add': BookOpen,
	'bible.search': Search,
	'word.lookup': BookA,
	'study.new': Plus,
	'selection.tag': Tag,
	'selection.duplicate': Copy,
	'selection.delete': Trash2,
	'sidebar.toggle': PanelLeft,
	'settings.open': Settings,
	'edit.undo': Undo2,
	'edit.redo': Redo2,
	'view.fit': Maximize,
	'view.actualSize': Scan,
	'view.zoomIn': ZoomIn,
	'view.zoomOut': ZoomOut,
	'appearance.system': SunMoon,
	'appearance.light': Sun,
	'appearance.dark': Moon,
	'intro.show': CirclePlay,
	'dev.fluidPopoverMotion': Spline,
}
const paletteCommands = commands.filter(
	(command) =>
		(typeof command.palette === 'function' ? command.palette(platform) : command.palette) ||
		(command.paletteWithoutMenuBar && !platform.nativeMenu),
)
const groups = (['Study', 'Selection', 'Workspace', 'View'] as const).filter((group) =>
	paletteCommands.some((command) => command.group === group),
)
/** Undo and redo act on what has focus, so they wait for the palette to hand it back. */
const runsAfterClose = new Set<CommandId>(['word.lookup', 'edit.undo', 'edit.redo'])

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
	const [search, setSearch] = useState('')
	const afterClose = useRef<(() => void) | null>(null)
	const typed = search.trim()
	const motion = useDialogMotion({ open, keyboard: 'instant' })
	function run(action: () => void, waitForClose = false) {
		if (!waitForClose)
			return handOff(() => {
				onOpenChange(false)
				action()
			})
		afterClose.current = action
		onOpenChange(false)
	}
	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Overlay className="dialog-overlay" data-motion={motion} />
				<Dialog.Content
					className="command-dialog"
					data-motion={motion}
					aria-describedby="command-description"
					onCloseAutoFocus={(event) => {
						const action = afterClose.current
						if (!action) return
						event.preventDefault()
						afterClose.current = null
						requestAnimationFrame(action)
					}}
				>
					<Dialog.Title className="sr-only">Commands</Dialog.Title>
					<Dialog.Description id="command-description" className="sr-only">
						Enter a Bible reference or search for a command.
					</Dialog.Description>
					<Command label="Commands">
						<div className="command-search">
							<Search {...iconMd} aria-hidden="true" />
							<Command.Input
								value={search}
								onValueChange={setSearch}
								placeholder="Enter a reference or command…"
							/>
							<kbd aria-hidden="true">Esc</kbd>
						</div>
						<Command.List>
							{/* A typed query always offers "Add verses ‹query›", so it is never empty then. */}
							{!typed && <Command.Empty>No matching commands.</Command.Empty>}
							{/* Outside the groups: cmdk hides a group with no matching items (forced ones too), and
							    forcing the group would force every command in it. */}
							{typed && (
								<Command.Item
									forceMount
									value={`add verses ${typed}`}
									onSelect={() => run(() => useUiStore.getState().openInsert(typed))}
								>
									<BookOpen {...iconMd} aria-hidden="true" />
									Add verses<span>{typed}</span>
								</Command.Item>
							)}
							{groups.map((group) => (
								<Command.Group key={group} heading={group}>
									{paletteCommands
										.filter((command) => command.group === group)
										.map((command) => {
											const Icon = command.id === 'palette.toggle' ? undefined : icons[command.id]
											const title = labelFor(command)
											return (
												<Command.Item
													key={command.id}
													value={title}
													disabled={!(command.available?.() ?? true)}
													onSelect={() =>
														run(() => runCommand(command.id), runsAfterClose.has(command.id))
													}
												>
													{Icon && <Icon {...iconMd} aria-hidden="true" />}
													{title}
													{command.shortcut && <kbd>{command.shortcut}</kbd>}
												</Command.Item>
											)
										})}
								</Command.Group>
							))}
						</Command.List>
					</Command>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	)
}
