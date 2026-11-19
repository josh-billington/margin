"""Generate compact, corpus-bound maps for every translation pair. No network."""
import argparse
import itertools
import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--database', type=Path, default=ROOT / 'resources/bible/margin-bible.sqlite')
db = sqlite3.connect(parser.parse_args().database)
translations = ['kjv', 'jps1917', 'bsb', 'web', 'asv']
refs = {tr: {f'{b}.{c}.{v}' for b, c, v in db.execute('SELECT book,chapter,verse FROM verses WHERE translationId=?', (tr,))} for tr in translations}
legacy = json.loads((ROOT / 'data/versification/kjv-jps1917.v1.json').read_text())
for tr in ['kjv', 'jps1917']:
    assert legacy['corpusRevisions'][tr] == db.execute('SELECT corpusRevision FROM editions WHERE translationId=?', (tr,)).fetchone()[0]
# WEB prints the doxology at the end of Romans 14. Romans 16:25 is a note-only label.
overrides = {'web': {f'ROM.16.{v}': f'ROM.14.{v - 1}' for v in range(25, 28)}}
links = {}
for tr in translations:
    if tr == 'jps1917':
        links[tr] = [(a, b) for entry in legacy['entries'] for a in entry['kjv'] for b in entry[tr]]
    else:
        links[tr] = [(ref, overrides.get(tr, {}).get(ref, ref)) for ref in refs['kjv'] if overrides.get(tr, {}).get(ref, ref) in refs[tr]]
    linked = {b for _, b in links[tr]}
    assert linked == refs[tr] if tr != 'jps1917' else linked <= refs[tr], (tr, refs[tr] - linked)

def sortref(ref):
    book, chapter, verse = ref.split('.')
    return book, int(chapter), int(verse)

maps = []
for source, target in itertools.combinations(translations, 2):
    adjacency = {}
    def edge(a, b):
        adjacency.setdefault(a, set()).add(b)
        adjacency.setdefault(b, set()).add(a)
    for tr in [source, target]:
        for anchor, ref in links[tr]:
            edge(('anchor', anchor), (tr, ref))
    seen, entries = set(), []
    for node in adjacency:
        if node in seen:
            continue
        component, todo = set(), [node]
        while todo:
            item = todo.pop()
            if item in component:
                continue
            component.add(item)
            todo.extend(adjacency[item] - component)
        seen.update(component)
        left = sorted((ref for tr, ref in component if tr == source), key=sortref)
        right = sorted((ref for tr, ref in component if tr == target), key=sortref)
        # Matching singleton references are implicit; absent counterparts remain unmapped.
        if left and right and not (len(left) == len(right) == 1 and left == right):
            entries.append(dict(source=left, target=right))
    entries.sort(key=lambda entry: sortref(entry['source'][0]))
    maps.append(dict(source=source, target=target, entries=entries))
    print(source, target, len(entries), 'exceptions to same-reference mapping')
result = dict(version=1, corpusRevisions={tr: db.execute('SELECT corpusRevision FROM editions WHERE translationId=?', (tr,)).fetchone()[0] for tr in translations}, maps=maps)
# One group per line keeps generated exceptions reviewable.
header = {k: v for k, v in result.items() if k != 'maps'}
text = json.dumps(header, indent=2)[:-2] + ',\n  "maps": [\n'
text += ',\n'.join('    ' + json.dumps({k: v for k, v in pair.items() if k != 'entries'})[:-1] + ', "entries": [\n' + ',\n'.join('      ' + json.dumps(entry, separators=(',', ':')) for entry in pair['entries']) + '\n    ]}' for pair in maps)
text += '\n  ]\n}\n'
(ROOT / 'data/versification/edition-maps.v1.json').write_text(text)
