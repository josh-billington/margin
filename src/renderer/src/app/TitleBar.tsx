import { useState } from 'react'
import { Command, PanelLeft, Settings } from 'lucide-react'
import { ToolButton } from './ToolButton'
import { SaveIndicator } from './SaveIndicator'
import type { SaveState } from './SaveIndicator'
import { runCommand, shortcutFor } from './commands'
import { useUiStore } from './uiStore'
import { iconLg } from '../lib/icons'

interface TitleBarProps {
	onRename?: (title: string) => void
	onRetry?: () => void
	onSaveCopy?: () => void
	title: string
	saveState?: SaveState
}

/** Reads as a window title; commits on blur or Enter and reverts on Escape. */
function TitleField({ title, onRename }: { title: string; onRename?: (title: string) => void }) {
	const [value, setValue] = useState(title)
	return (
		<input
			className="title-input"
			aria-label="Study title"
			disabled={!onRename}
			value={value}
			spellCheck={false}
			onChange={(event) => setValue(event.target.value)}
			onFocus={(event) => event.currentTarget.select()}
			onBlur={() => {
				const next = value.trim()
				if (next && next !== title) onRename?.(next)
				else setValue(title)
			}}
			onKeyDown={(event) => {
				if (event.key === 'Enter') event.currentTarget.blur()
				else if (event.key === 'Escape') {
					setValue(title)
					event.currentTarget.blur()
				}
			}}
		/>
	)
}

export function TitleBar({ title, onRename, onRetry, onSaveCopy, saveState }: TitleBarProps) {
	const sidebarOpen = useUiStore((state) => state.sidebarOpen)
	return (
		<header className="title-bar">
			<div className="title-leading">
				<ToolButton
					label="Toggle sidebar"
					shortcut={shortcutFor('sidebar.toggle')}
					onClick={() => runCommand('sidebar.toggle')}
					aria-expanded={sidebarOpen}
					aria-controls="sidebar"
				>
					<PanelLeft {...iconLg} />
				</ToolButton>
			</div>
			<h1>
				<TitleField key={title} title={title} onRename={onRename} />
			</h1>
			<div className="title-actions">
				{saveState && <SaveIndicator state={saveState} onRetry={onRetry} onSaveCopy={onSaveCopy} />}
				<ToolButton
					label="Open command palette"
					shortcut={shortcutFor('palette.toggle')}
					onClick={() => runCommand('palette.toggle')}
				>
					<Command {...iconLg} />
				</ToolButton>
				<ToolButton
					label="Settings"
					shortcut={shortcutFor('settings.open')}
					onClick={() => runCommand('settings.open')}
				>
					<Settings {...iconLg} />
				</ToolButton>
			</div>
		</header>
	)
}
