import { create } from 'zustand'

interface UiState {
	sidebarOpen: boolean
	paletteOpen: boolean
	settingsOpen: boolean
	/** Insert-verses dialog: null when closed, otherwise the initial query. */
	insertQuery: string | null
	toggleSidebar: () => void
	setPaletteOpen: (open: boolean) => void
	togglePalette: () => void
	setSettingsOpen: (open: boolean) => void
	openInsert: (query?: string) => void
	closeInsert: () => void
}

export const useUiStore = create<UiState>((set) => ({
	sidebarOpen: true,
	paletteOpen: false,
	settingsOpen: false,
	insertQuery: null,
	toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
	setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
	togglePalette: () => set((state) => ({ paletteOpen: !state.paletteOpen })),
	setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
	openInsert: (query = '') => set({ insertQuery: query }),
	closeInsert: () => set({ insertQuery: null }),
}))
