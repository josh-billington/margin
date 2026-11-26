import posthog from 'posthog-js'
import { site } from '@/lib/site'

// Web analytics on the live site only, so local dev and PR previews don't count as visits.
if (location.hostname === new URL(site.url).hostname)
	posthog.init(site.posthog.key, {
		api_host: site.posthog.host,
		defaults: '2026-08-30',
		// Nothing is stored on the device (no cookies, no local storage): a visit is counted, not a visitor.
		persistence: 'memory',
		disable_session_recording: true,
		disable_surveys: true,
		// Everything runs from the bundled script; nothing else loads from PostHog's servers. Dead-click
		// capture and Web Vitals need scripts from there, so they stay off rather than failing.
		disable_external_dependency_loading: true,
		capture_dead_clicks: false,
		capture_performance: false,
	})
