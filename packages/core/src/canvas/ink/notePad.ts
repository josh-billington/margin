export const NOTE_INK_WIDTH = 320
export const NOTE_INK_HEIGHT = 128
export const NOTE_INK_INSET = 8
export const noteInkHeight = (width: number) =>
	((width - NOTE_INK_INSET * 2) / NOTE_INK_WIDTH) * NOTE_INK_HEIGHT
