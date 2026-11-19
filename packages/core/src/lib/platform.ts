import { platformSchema } from '@shared/ipc/contract'

/** Capture the host's capabilities once, before the renderer mounts. */
export const platform = platformSchema.parse(window.margin.platform)
