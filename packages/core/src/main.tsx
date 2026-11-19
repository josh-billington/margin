import './styles/index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { syncAppearance, syncGlassMode, trackInputModality } from './app/glass'
import { platform } from './lib/platform'

const root = document.getElementById('root')
if (!root) throw new Error('Margin root element is missing')
document.documentElement.dataset.platform = platform.kind
syncAppearance()
syncGlassMode()
trackInputModality()
createRoot(root).render(
	<StrictMode>
		<App />
	</StrictMode>,
)
