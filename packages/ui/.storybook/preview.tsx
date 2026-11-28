import type { Preview } from '@storybook/react-vite'
import '../src/styles/tokens.css'
import './preview.css'

/*
 * The app sets its appearance on <html data-appearance>; tokens.css reads it. The toolbar switch
 * does the same here, so every story can be checked in light and dark. The touch scale switch
 * arrives with the touch scale layer (docs/plans/design-system.md, step 1a).
 */
const preview: Preview = {
	globalTypes: {
		appearance: {
			description: 'Appearance',
			toolbar: {
				title: 'Appearance',
				icon: 'mirror',
				items: [
					{ value: 'dark', title: 'Dark' },
					{ value: 'light', title: 'Light' },
				],
				dynamicTitle: true,
			},
		},
	},
	initialGlobals: { appearance: 'dark' },
	decorators: [
		(Story, { globals }) => {
			document.documentElement.dataset.appearance =
				globals.appearance === 'light' ? 'light' : 'dark'
			return <Story />
		},
	],
	parameters: { layout: 'padded', a11y: { test: 'error' } },
}
export default preview
