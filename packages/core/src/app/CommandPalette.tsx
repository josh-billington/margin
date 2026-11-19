import { useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Command } from 'cmdk'
import {
	BookOpen,
	Copy,
	Maximize,
	PanelLeft,
	Plus,
	Redo2,
	Settings,
	Search,
	Tag,
	Trash2,
	Undo2,
	type LucideIcon,
} from 'lucide-react'
import { commands, labelFor, runCommand } from './commands'
import type { CommandId } from './commands'
import { useUiStore } from './uiStore'
import { iconMd } from '../lib/icons'
import { platform } from '../lib/platform'

interface CommandPaletteProps {
	open: boolean
	onOpenChange: (open: boolean) => void
}

const icons: Partial<Record<CommandId, LucideIcon>> = {
	'passage.add': BookOpen,
	'word.lookup': Search,
	'study.new': Plus,
	'selection.tag': Tag,
	'selection.duplicate': Copy,
	'selection.delete': Trash2,
	'sidebar.toggle': PanelLeft,
	'settings.open': Settings,
	'edit.undo': Undo2,
	'edit.redo': Redo2,
	'view.fit': Maximize,
}
const paletteCommands = commands.filter(
	(command) => command.palette || (command.paletteWithoutMenuBar && !platform.nativeMenu),
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
	function run(action: () => void, waitForClose = false) {
		if (waitForClose) afterClose.current = action
		onOpenChange(false)
		if (!waitForClose) action()
	}
	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Overlay className="dialog-overlay palette-overlay" />
				<Dialog.Content
					className="command-dialog"
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
											const Icon = icons[command.id]
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
