/// <reference types="vite/client" />
import type { MarginApi } from '@shared/ipc/contract'

declare global {
	interface Window {
		margin: MarginApi
	}
	interface ImportMetaEnv {
		readonly VITE_TLDRAW_LICENSE_KEY?: string
	}
}
