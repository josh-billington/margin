import type { ReactNode } from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { Toaster } from 'sonner'
import { useAppearance } from './glass'

export function AppProviders({ children }: { children: ReactNode }) {
	const appearance = useAppearance()
	return (
		<Tooltip.Provider delayDuration={350} skipDelayDuration={300}>
			{children}
			<Toaster
				theme={appearance}
				position="bottom-right"
				offset={{ bottom: 72, right: 16 }}
				toastOptions={{ classNames: { actionButton: 'button button-primary', cancelButton: 'button' } }}
			/>
		</Tooltip.Provider>
	)
}
