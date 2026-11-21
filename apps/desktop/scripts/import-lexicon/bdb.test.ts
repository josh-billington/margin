import { describe, expect, it } from 'vitest'
import { parseBdb, mapBdb } from './bdb'
import { bdbCitation, bdbDisplaySenses, bdbMetadata } from '@shared/lexicon/bdb'
import { expandBdbPos, expandBdbStem, expandBdbAspect, expandBdbInline } from './bdbAbbreviations'

const bdbXml =
	'\uFEFF' +
	`<?xml version="1.0"?>
<lexicon xmlns="urn:bdb"><part><section>
<entry id="create"><w>בָּרָא</w> 53 <pos>vb</pos>. <def>shape</def>, <def>create</def>
 <sense><stem>Qal</stem> <asp>Pf</asp>.— <def>shape &amp; fashion</def> <w>א</w> <ref>Gn 1:1</ref>
  <sense n="a"><def>create</def> H1961 (הָיָה)</sense> after
 </sense>
 <sense><stem>Niph.</stem> <sense n="1"><def>be created</def></sense></sense>
 <status p="135">base</status><page p="135"/>
</entry>
<entry id="fat"><w>בָּרָא</w> <pos>vb</pos>. <def>be fat</def></entry>
<entry id="unlinked"><w>אָב</w> <def>father</def></entry>
</section></part></lexicon>`
const lexicalXml = `<index><part>
<entry id="fat-index"><def>be fat</def><xref bdb="fat" strong="1254" aug="b"/></entry>
<entry id="create-index"><def>shape</def><xref bdb="create" strong="01254" aug="a"/></entry>
<entry id="duplicate"><xref bdb="create" strong="1254"/></entry>
<entry id="another"><xref bdb="create" strong="2"/></entry>
<entry id="missing"><xref bdb="missing" strong="3"/></entry>
<entry id="no-bdb"><xref strong="4"/></entry>
<entry id="no-strong"><xref bdb="unlinked"/></entry>
<entry id="prefix"><xref bdb="unlinked" strong="b"/></entry>
</part></index>`
const augmentedXml = `<index><w aug="1254a">create-index</w><w aug="1254b">fat-index</w><w aug="2">another</w></index>`

describe('bundled BDB XML', () => {
	it('keeps typed Hebrew inside definitions and strips punctuation-only boundaries', () => {
		const entry = parseBdb(
			'<lexicon><entry id="nested"><w>א</w> 2570 <pos>n.m.pl</pos>.— <def>God <w>אֵל</w></def><page>10</page></entry></lexicon>',
		).get('nested')
		expect(entry?.senses[0]?.text).toEqual([
			{ kind: 'def', text: 'God' },
			{ kind: 'hebrew', text: 'אֵל' },
		])
		expect(entry && bdbMetadata(entry)).toBe('masculine plural noun · 2,570 occurrences')
	})
	it('expands grammatical abbreviations and retains unfamiliar prose', () => {
		expect(expandBdbPos('n.m.pl')).toBe('masculine plural noun')
		expect(expandBdbPos('n.[f.]')).toBe('feminine noun')
		expect(expandBdbPos('n.pr.loc')).toBe('place name')
		expect(expandBdbPos('pr.n.m.')).toBe('masculine proper name')
		expect(expandBdbPos('pr.n.loc.')).toBe('place name')
		expect(expandBdbStem('Hithp.')).toBe('Hithpael')
		expect(expandBdbAspect('Pt. pass')).toBe('participle passive')
		expect(expandBdbInline('pl. fig. unknown.')).toBe('plural figurative unknown.')
		expect(expandBdbPos('unknown.')).toBe('unknown.')
		expect(expandBdbStem('unknown.')).toBe('unknown.')
		expect(expandBdbAspect('unknown.')).toBe('unknown.')
	})
	it('retains leaf definitions and root stem content, omitting only the redundant wrapper', () => {
		const entries = parseBdb(bdbXml)
		const leaf = entries.get('fat')
		const branch = entries.get('create')
		expect(leaf && bdbDisplaySenses(leaf)[0]?.text).toEqual([{ kind: 'def', text: 'be fat' }])
		expect(branch && bdbDisplaySenses(branch)[0]?.label).toBe('Qal perfect')
	})

	it('keeps Hebrew, inline text, labels and nested sense numbers without markup or editorial markers', () => {
		const entries = parseBdb(bdbXml)
		expect(entries.size).toBe(3)
		const entry = entries.get('create')
		expect(entry?.lemma).toBe('בָּרָא')
		expect(entry?.gloss).toBe('shape, create')
		expect(entry?.pos).toBe('verb')
		expect(entry?.count).toBe(53)
		expect(entry?.senses[0]?.label).toBeUndefined()
		expect(entry?.senses[0]?.senses).toEqual([
			{
				label: 'Qal perfect',
				text: [
					{ kind: 'def', text: 'shape & fashion' },
					{ kind: 'hebrew', text: 'א' },
					{ kind: 'ref', text: 'Gn 1:1' },
					{ kind: 'text', text: 'after' },
				],
				senses: [
					{
						number: 'a',
						text: [
							{ kind: 'def', text: 'create' },
							{ kind: 'text', text: 'H1961 (הָיָה)' },
						],
						senses: [],
					},
				],
			},
			{
				label: 'Niphal',
				text: [],
				senses: [{ number: '1', text: [{ kind: 'def', text: 'be created' }], senses: [] }],
			},
		])
		expect(JSON.stringify(entry)).not.toMatch(/<|base|135/)
	})
	it('maps only explicit numeric Strong’s links, normalizes zeros, keeps homograph order and deduplicates', () => {
		const { byStrong, missingBdb } = mapBdb({ entries: parseBdb(bdbXml), lexicalXml, augmentedXml })
		expect([...byStrong.keys()]).toEqual(['H1254', 'H2'])
		expect(byStrong.get('H1254')?.map((entry) => [entry.id, entry.gloss])).toEqual([
			['create', 'shape'],
			['fat', 'be fat'],
		])
		expect(byStrong.get('H2')?.[0]?.id).toBe('create')
		expect(missingBdb).toEqual(['H3', 'H4'])
	})
	it('records augmented-index inconsistencies and retains the lexical Strong’s association', () => {
		const result = mapBdb({
			entries: parseBdb(bdbXml),
			lexicalXml,
			augmentedXml: '<index><w aug="2007">another</w></index>',
		})
		expect(result.augmentedMismatches).toEqual(['2007 → another (H2)'])
		expect(result.byStrong.get('H2')?.[0]?.id).toBe('create')
		expect(result.byStrong.has('H2007')).toBe(false)
	})
	it('rejects malformed XML, entities requiring a DTD and duplicate entry identities', () => {
		expect(() => parseBdb('<lexicon><entry></lexicon>')).toThrow()
		expect(() =>
			parseBdb('<!DOCTYPE lexicon [<!ENTITY x SYSTEM "file:///tmp/secret">]><lexicon/>'),
		).toThrow('DOCTYPE')
		expect(() => parseBdb('<lexicon><entry id="a"/><entry id="a"/></lexicon>')).toThrow('duplicate')
	})
	it('copies all homographs with sense labels and dictionary-only citations', () => {
		const { byStrong } = mapBdb({ entries: parseBdb(bdbXml), lexicalXml, augmentedXml })
		const citation = bdbCitation({ id: 'H1254', entries: byStrong.get('H1254') ?? [] })
		expect(citation).toContain('Qal perfect: shape & fashion')
		expect(citation).toContain('be fat')
		expect(citation.match(/Brown-Driver-Briggs · H1254/g)).toHaveLength(2)
		expect(citation).not.toMatch(/Sefaria|Open Scriptures|<def>/)
	})
})
