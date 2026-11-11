import { AppProviders } from './app/AppProviders'
import { AppShell } from './app/AppShell'
import { DialogsHost } from './app/DialogsHost'
import { useAppBootstrap } from './app/useAppBootstrap'
import { useGlobalShortcuts } from './app/useGlobalShortcuts'

export function App() {
	useAppBootstrap()
	useGlobalShortcuts()
	return (
		<AppProviders>
			<AppShell />
			<DialogsHost />
		</AppProviders>
	)
}
