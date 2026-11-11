import { useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Command } from 'cmdk'
import {
	BookOpen,
	Copy,
	PanelLeft,
	Plus,
	Settings,
	Search,
	Tag,
	Trash2,
	type LucideIcon,
} from 'lucide-react'
import { commands, runCommand } from './commands'
import type { CommandId } from './commands'
import { useUiStore } from './uiStore'
import { iconMd } from '../lib/icons'

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
}
const groups = ['Study', 'Selection', 'Workspace'] as const
const paletteCommands = commands.filter((command) => command.palette)

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
						Type a reference to add verses, or search for a command.
					</Dialog.Description>
					<Command label="Commands">
						<div className="command-search">
							<Search {...iconMd} aria-hidden="true" />
							<Command.Input
								value={search}
								onValueChange={setSearch}
								placeholder="Type a reference or a command…"
							/>
							<kbd aria-hidden="true">esc</kbd>
						</div>
						<Command.List>
							<Command.Empty>No matching commands.</Command.Empty>
							{groups.map((group) => (
								<Command.Group key={group} heading={group}>
									{group === 'Study' && typed && (
										<Command.Item
											forceMount
											value={`add verses ${typed}`}
											onSelect={() => run(() => useUiStore.getState().openInsert(typed))}
										>
											<BookOpen {...iconMd} aria-hidden="true" />
											Add verses<span>{typed}</span>
										</Command.Item>
									)}
									{paletteCommands
										.filter((command) => command.group === group)
										.map((command) => {
											const Icon = icons[command.id]
											return (
												<Command.Item
													key={command.id}
													value={command.title}
													onSelect={() =>
														run(() => runCommand(command.id), command.id === 'word.lookup')
													}
												>
													{Icon && <Icon {...iconMd} aria-hidden="true" />}
													{command.title}
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
