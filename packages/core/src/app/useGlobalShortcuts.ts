import { useEffect } from 'react'
import { commands, runCommand } from './commands'

/** One keydown listener for every ⌘-bound command in the registry. Registered once. */
export function useGlobalShortcuts() {
	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if (event.isComposing || !event.metaKey || event.altKey) return
			const key = event.key.toLowerCase()
			const match = commands.find(
				(command) =>
					command.binding &&
					command.binding.key === key &&
					!!command.binding.shift === event.shiftKey &&
					!!command.binding.ctrl === event.ctrlKey,
			)
			if (!match) return
			event.preventDefault()
			// Holding ⌘N makes one study, not one per key repeat.
			if (event.repeat && match.id === 'study.new') return
			if (match.id === 'word.lookup') event.stopImmediatePropagation()
			runCommand(match.id)
		}
		window.addEventListener('keydown', onKeyDown, true)
		return () => window.removeEventListener('keydown', onKeyDown, true)
	}, [])
}
