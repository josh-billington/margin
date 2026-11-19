import { installHost } from './host'

declare const __IPAD_PROBE__: boolean

await installHost()
await import('../../../packages/core/src/main')
if (__IPAD_PROBE__) await import('./probe')
