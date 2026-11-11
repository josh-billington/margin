import type { BookId, PassageText } from '@shared/bible/types'

function fixture(book: BookId, chapter: number, first: number, lines: string[]): PassageText {
	return {
		edition: {
			translationId: 'kjv',
			editionName: 'King James Version (dev fixture)',
			versificationId: 'kjv',
			corpusRevision: 'margin-fixture-1',
			tokenizerVersion: 'fixture-1',
		},
		ranges: [
			{
				start: { book, chapter, verse: first },
				end: { book, chapter, verse: first + lines.length - 1 },
			},
		],
		verses: lines.map((line, offset) => ({
			ref: { book, chapter, verse: first + offset },
			paragraphBreakBefore: false,
			tokens: line.split(' ').map((text, i, all) => ({
				i,
				leading: '',
				runs: [{ text: text.replaceAll('*', ''), italic: text.includes('*') }],
				trailing: '',
				spaceAfter: i === all.length - 1 ? '' : ' ',
			})),
		})),
	}
}
export const amosFixture = fixture('AMO', 1, 3, [
	'Thus saith the LORD; For three transgressions of Damascus, and for four, I will not turn away *the* *punishment* *thereof;* because they have threshed Gilead with threshing instruments of iron:',
	'But I will send a fire into the house of Hazael, which shall devour the palaces of Benhadad.',
	'I will break also the bar of Damascus, and cut off the inhabitant from the plain of Aven, and him that holdeth the sceptre from the house of Eden: and the people of Syria shall go into captivity unto Kir, saith the LORD.',
])
export const psalmFixture = fixture('PSA', 119, 1, [
	'Blessed are the undefiled in the way, who walk in the law of the LORD.',
	'Blessed are they that keep his testimonies, and that seek him with the whole heart.',
	'They also do no iniquity: they walk in his ways.',
	'Thou hast commanded us to keep thy precepts diligently.',
	'O that my ways were directed to keep thy statutes!',
	'Then shall I not be ashamed, when I have respect unto all thy commandments.',
	'I will praise thee with uprightness of heart, when I shall have learned thy righteous judgments.',
	'I will keep thy statutes: O forsake me not utterly.',
	'Wherewithal shall a young man cleanse his way? by taking heed thereto according to thy word.',
	'With my whole heart have I sought thee: O let me not wander from thy commandments.',
	'Thy word have I hid in mine heart, that I might not sin against thee.',
	'Blessed art thou, O LORD: teach me thy statutes.',
	'With my lips have I declared all the judgments of thy mouth.',
	'I have rejoiced in the way of thy testimonies, as much as in all riches.',
	'I will meditate in thy precepts, and have respect unto thy ways.',
	'I will delight myself in thy statutes: I will not forget thy word.',
])
