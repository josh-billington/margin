'use client'
import { useEffect } from 'react'

/** Adds .is-in to [data-reveal] elements once as they enter the viewport. */
export function Reveal() {
	useEffect(() => {
		const items = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))
		if (!('IntersectionObserver' in window)) {
			items.forEach((el) => el.classList.add('is-in'))
			return
		}
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) continue
					entry.target.classList.add('is-in')
					observer.unobserve(entry.target)
				}
			},
			{ rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
		)
		items.forEach((el) => observer.observe(el))
		return () => observer.disconnect()
	}, [])
	return null
}
