import './styles/index.css'
import touchStyles from './styles/touch.css?inline'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { syncAppearance, syncGlassMode, trackInputModality } from './app/glass'
import { platform } from './lib/platform'
import { initializeIntro } from './intro/introStore'

const root = document.getElementById('root')
if (!root) throw new Error('Margin root element is missing')
document.documentElement.dataset.platform = platform.kind
// Touch styles load only on touch hosts. Their `:has()` rules, even unmatched, make Chromium
// recalculate styles across a heavy study on every zoom frame on the Mac.
if (!platform.nativeMenu || matchMedia('(pointer: coarse), (hover: none)').matches) {
	const style = document.createElement('style')
	style.textContent = touchStyles
	document.head.append(style)
}
initializeIntro({ platform, atLaunch: window.margin.introAtLaunch })
syncAppearance()
syncGlassMode()
trackInputModality()
createRoot(root).render(
	<StrictMode>
		<App />
	</StrictMode>,
)
