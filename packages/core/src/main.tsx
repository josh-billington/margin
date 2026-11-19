import './styles/index.css'
import touchStyles from './styles/touch.css?inline'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { syncAppearance, syncGlassMode, trackInputModality } from './app/glass'
import { platform } from './lib/platform'

const root = document.getElementById('root')
if (!root) throw new Error('Margin root element is missing')
document.documentElement.dataset.platform = platform.kind
// Touch-route styles load only where they can apply, so the Mac's stylesheet stays unchanged: a few
// more rules of any kind make Chromium's style recalculation many times slower when zooming a
// heavy study.
if (!platform.nativeMenu || matchMedia('(pointer: coarse), (hover: none)').matches) {
	const style = document.createElement('style')
	style.textContent = touchStyles
	document.head.append(style)
}
syncAppearance()
syncGlassMode()
trackInputModality()
createRoot(root).render(
	<StrictMode>
		<App />
	</StrictMode>,
)
