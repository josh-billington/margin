import './styles/index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { syncAppearance, syncGlassMode, trackInputModality } from './app/glass'

const root = document.getElementById('root')
if (!root) throw new Error('Margin root element is missing')
syncAppearance()
syncGlassMode()
trackInputModality()
createRoot(root).render(
	<StrictMode>
		<App />
	</StrictMode>,
)
