'use client'
import React from 'react'
import { LENS_SHIFT, lensField } from '@/lib/lens-field'

/*
 * The app's refractive glass (packages/core/src/app/toolbarGlass.tsx), for the site's header: an SVG
 * displacement map through `backdrop-filter: url()` bends what is behind the element at its rim and
 * leaves the middle undistorted. Only Chromium renders a backdrop through SVG, so other browsers keep
 * the frosted glass.
 */

interface Lens {
	id: string
	width: number
	height: number
	map: string
}

let lensVersion = 0

const isChromium = () =>
	typeof navigator !== 'undefined' &&
	((navigator as Navigator & { userAgentData?: { brands: { brand: string }[] } }).userAgentData?.brands.some(
		(entry) => entry.brand === 'Chromium',
	) ??
		false)

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

/** Props and SVG defs that give a `.glass` element the lens, following its size. Off: nothing. */
export function useGlassLens<T extends HTMLElement>(on: boolean) {
	const ref = React.useRef<T>(null)
	const [lens, setLens] = React.useState<Lens | null>(null)

	React.useLayoutEffect(() => {
		const element = ref.current
		if (!on || !element || !isChromium()) {
			setLens(null)
			return
		}
		const measure = () => {
			const { width, height } = element.getBoundingClientRect()
			if (!width || !height) return
			const radius = Number.parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0
			setLens((previous) =>
				previous && previous.width === width && previous.height === height
					? previous
					: { id: `glass-lens-${++lensVersion}`, width, height, map: lensMap(width, height, radius) },
			)
		}
		measure()
		const observer = new ResizeObserver(measure)
		observer.observe(element)
		return () => observer.disconnect()
	}, [on])

	const props = lens
		? { 'data-lens': '', style: { '--glass-lens': `url(#${lens.id})` } as React.CSSProperties }
		: {}
	const defs = lens ? (
		<svg aria-hidden="true" width="0" height="0" className="absolute size-0">
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
