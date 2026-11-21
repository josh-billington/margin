import { registerPlugin } from '@capacitor/core'

export const nativeFiles = registerPlugin<{
	rename(options: { from: string; to: string }): Promise<void>
	beginBackgroundFlush(): Promise<void>
	finishBackgroundFlush(): Promise<void>
}>('MarginFiles')
