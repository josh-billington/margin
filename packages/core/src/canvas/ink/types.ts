import type { TLBinding, TLShape } from 'tldraw'
import type { InkBindingProps, InkShapeProps } from '@shared/study/types'

declare module 'tldraw' {
	interface TLGlobalShapePropsMap {
		'margin-ink': InkShapeProps
	}
	interface TLGlobalBindingPropsMap {
		'margin-ink': InkBindingProps
	}
}

export type InkShape = TLShape<'margin-ink'>
export type InkBinding = TLBinding<'margin-ink'>
