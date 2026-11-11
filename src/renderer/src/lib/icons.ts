/**
 * Lucide sizes. `absoluteStrokeWidth` keeps one rendered stroke (1.25px) at every size, so a 12px
 * row glyph and a 16px toolbar glyph read as the same weight, like SF Symbols at one weight.
 */
const stroke = { strokeWidth: 1.25, absoluteStrokeWidth: true } as const

export const iconSm = { size: 12, ...stroke } as const
export const iconMd = { size: 14, ...stroke } as const
export const iconLg = { size: 16, ...stroke } as const
