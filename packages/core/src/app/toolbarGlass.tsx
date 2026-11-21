import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { CSSProperties } from 'react'
import type { Platform } from '@shared/ipc/contract'
import { LENS_SHIFT, lensField } from './lensField'

/*
 * Experiment, on by default: the floating canvas toolbar as refractive glass. An SVG lens
 * (feDisplacementMap through `backdrop-filter: url()`, which only Chromium renders) bends the
 * canvas at the toolbar's rim and leaves its middle undistorted; frost and a tint keep the
 * buttons readable. Mac only; the iPad's WebKit can't filter a backdrop through SVG.
 *
 * "Toggle glass toolbar" in the command palette flips it and remembers the choice in
 * localStorage. MARGIN_TOOLBAR_GLASS=1 or 0 sets it at launch, for captures and tests.
 */

const STORAGE_KEY = 'margin.toolbarGlass'
// Read when first needed, not on import, so modules that list commands load without a host.
const launchValue = () => window.margin.toolbarGlass
const supported = () => window.margin.platform.kind === 'mac'

let enabled: boolean | undefined
const isEnabled = () =>
	(enabled ??=
		supported() &&
		(launchValue() === undefined
			? localStorage.getItem(STORAGE_KEY) !== '0'
			: launchValue() !== '0'))
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => {
	listeners.add(listener)
	return () => listeners.delete(listener)
}

/** Listed in the palette in development, or when a launch set the flag, so merging adds no row. */
export const toolbarGlassListed = (host: Platform) =>
	host.kind === 'mac' && (import.meta.env.DEV || launchValue() !== undefined)

export function toggleToolbarGlass() {
	if (!supported()) return
	enabled = !isEnabled()
	localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
	for (const listener of listeners) listener()
}

const useToolbarGlassEnabled = () => useSyncExternalStore(subscribe, isEnabled)

interface Lens {
	id: string
	width: number
	height: number
	map: string
}

function lensMap(width: number, height: number, radius: number) {
	// Map pixels per CSS px; above 2 buys nothing on a Retina display.
	const scale = Math.min(2, Math.max(1, window.devicePixelRatio || 1))
	const { columns, rows, data } = lensField(width, height, radius, scale)
	const canvas = document.createElement('canvas')
	canvas.width = columns
	canvas.height = rows
	const context = canvas.getContext('2d')
	if (!context) return ''
	context.putImageData(new ImageData(data, columns, rows), 0, 0)
	return canvas.toDataURL()
}

let lensVersion = 0

/**
 * Wires the experiment into the toolbar: returns the props for its root and the SVG filter to
 * render inside it, or nothing while the flag is off. The map follows the toolbar's size.
 */
export function useToolbarGlass() {
	const on = useToolbarGlassEnabled()
	const ref = useRef<HTMLDivElement>(null)
	const [lens, setLens] = useState<Lens | null>(null)

	useLayoutEffect(() => {
		const element = ref.current
		if (!on || !element) {
			setLens(null)
			return
		}
		const measure = () => {
			const { width, height } = element.getBoundingClientRect()
			const radius = Number.parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0
			setLens((previous) =>
				previous && previous.width === width && previous.height === height
					? previous
					: {
							id: `toolbar-lens-${++lensVersion}`,
							width,
							height,
							map: lensMap(width, height, radius),
						},
			)
		}
		measure()
		const observer = new ResizeObserver(measure)
		observer.observe(element)
		return () => observer.disconnect()
	}, [on])

	const props = on
		? {
				'data-lens': '',
				style: lens ? ({ '--toolbar-lens': `url(#${lens.id})` } as CSSProperties) : undefined,
			}
		: {}
	const defs =
		on && lens ? (
			<svg className="toolbar-lens-defs" aria-hidden="true" width="0" height="0">
				<filter
					id={lens.id}
					x="0"
					y="0"
					width={lens.width}
					height={lens.height}
					filterUnits="userSpaceOnUse"
					primitiveUnits="userSpaceOnUse"
					colorInterpolationFilters="sRGB"
				>
					<feImage
						href={lens.map}
						x="0"
						y="0"
						width={lens.width}
						height={lens.height}
						preserveAspectRatio="none"
						result="map"
					/>
					<feDisplacementMap
						in="SourceGraphic"
						in2="map"
						scale={2 * LENS_SHIFT}
						xChannelSelector="R"
						yChannelSelector="G"
					/>
				</filter>
			</svg>
		) : null
	return { ref, props, defs }
}
