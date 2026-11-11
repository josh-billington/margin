"""Regenerate the edition-specific map from the imported DB and pinned SIL tables. No network."""
import argparse
import hashlib
import json
import re
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--database', type=Path, default=ROOT / 'resources/bible/margin-bible.sqlite')
db = sqlite3.connect(parser.parse_args().database)
refs = {tr: {f'{b}.{c}.{v}' for b, c, v in db.execute('SELECT book, chapter, verse FROM verses WHERE translationId=?', (tr,))} for tr in ['kjv', 'jps1917']}
edges = set()
books = {ref.split('.')[0] for ref in refs['jps1917']}
unmapped_kjv = {'NEH.7.68'}  # Horses and mules are absent from this JPS verse array.

def expand(book, chapter, first, last):
    return [f'{book}.{chapter}.{v}' for v in range(int(first), int(last or first) + 1)]

for line in (ROOT / 'data/versification/eng.vrs.txt').read_text().splitlines():
    m = re.fullmatch(r'(\w{3}) (\d+):(\d+)(?:-(\d+))? = (\w{3}) (\d+):(\d+)(?:-(\d+))?', line)
    if not m or m[1] not in books or m[5] not in books:
        continue
    left = expand(*m.group(1, 2, 3, 4))
    right = expand(*m.group(5, 6, 7, 8))
    pairs = zip(left, right) if len(left) == len(right) else ((a, b) for a in left for b in right)
    for a, b in pairs:
        if a in refs['kjv'] and b in refs['jps1917']:
            edges.add((a, b))

# Edition-specific whole-verse groups, checked against the actual imported words.
# A partial selection of a multi-verse side requires confirmation in the loader.
overrides = [
    (expand('EXO', 20, 13, 16), ['EXO.20.13']),
    (expand('DEU', 5, 17, 20), ['DEU.5.17']),
    *[([f'EXO.20.{v}'], [f'EXO.20.{v - 3}']) for v in range(17, 27)],
    *[([f'DEU.5.{v}'], [f'DEU.5.{v - 3}']) for v in range(21, 34)],
    (['1SA.20.42'], ['1SA.20.42', '1SA.21.1']),
    (['1KI.18.33', '1KI.18.34'], ['1KI.18.33', '1KI.18.34']),
    (['1KI.22.43'], ['1KI.22.43', '1KI.22.44']),
    (['1CH.12.4'], ['1CH.12.4', '1CH.12.5']),
    (['PSA.13.5', 'PSA.13.6'], ['PSA.13.6']),
    (['ISA.63.19', 'ISA.64.1'], ['ISA.63.19']),
]
for left, right in overrides:
    edges = {(a, b) for a, b in edges if a not in left and b not in right}
    edges.update((a, b) for a in left for b in right)
claimed_left = {a for a, _ in edges}
claimed_right = {b for _, b in edges}
for ref in refs['kjv'] & refs['jps1917']:
    if ref not in claimed_left and ref not in claimed_right and ref not in unmapped_kjv:
        edges.add((ref, ref))

# Connected components preserve one-to-many, many-to-one, and inseparable verse groups.
adjacency = {}
for a, b in edges:
    a, b = ('kjv', a), ('jps1917', b)
    adjacency.setdefault(a, set()).add(b)
    adjacency.setdefault(b, set()).add(a)
seen = set()
entries = []
book_order = {b: n for n, (b,) in enumerate(db.execute("SELECT id FROM books WHERE translationId='kjv' ORDER BY ordinal"))}
def sortref(ref):
    b, c, v = ref.split('.')
    return book_order[b], int(c), int(v)
for node in sorted(adjacency, key=lambda n: (n[0], sortref(n[1]))):
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
    entries.append({tr: sorted([ref for translation, ref in component if translation == tr], key=sortref) for tr in refs})
unmapped = []
for tr in refs:
    absent = refs[tr] - {ref for translation, ref in seen if translation == tr}
    for ref in sorted(absent, key=sortref):
        b, c, v = ref.split('.')
        reason = 'JPS 1917 does not contain the New Testament.' if b not in books else 'Numbered JPS superscription corresponds to unnumbered KJV metadata.' if tr == 'jps1917' and b == 'PSA' else 'No equivalent text in the pinned JPS export.' if ref == 'NEH.7.68' else 'Not verified for these exact editions; confirmation required.'
        unmapped.append({'translationId': tr, 'ref': ref, 'reason': reason})
        if b in books and not (tr == 'jps1917' and b == 'PSA'):
            print('REVIEW:', tr, ref, reason)
source = ROOT / 'data/versification/eng.vrs.txt'
original = ROOT / 'data/versification/org.vrs.txt'
result = dict(version=1, source='SIL Global libpalaso English -> BHS, adapted to the exact Margin editions', upstreamRevision='b4f7a6da7b868f9ae909e40fb0708f5fd4efd782', upstreamUrl='https://raw.githubusercontent.com/sillsdev/libpalaso/b4f7a6da7b868f9ae909e40fb0708f5fd4efd782/SIL.Scripture/Resources/eng.vrs.txt', upstreamSha256=hashlib.sha256(source.read_bytes()).hexdigest(), originalSha256=hashlib.sha256(original.read_bytes()).hexdigest(), corpusRevisions={tr: db.execute('SELECT corpusRevision FROM editions WHERE translationId=?', (tr,)).fetchone()[0] for tr in refs}, entries=entries, unmapped=unmapped)
# One semantic group per line makes the generated data reviewable without huge pretty-print diffs.
header = {k: v for k, v in result.items() if k not in ['entries', 'unmapped']}
text = json.dumps(header, indent=2)[:-2] + ',\n  "entries": [\n' + ',\n'.join('    ' + json.dumps(e, separators=(',', ':')) for e in entries) + '\n  ],\n  "unmapped": [\n' + ',\n'.join('    ' + json.dumps(e, separators=(',', ':')) for e in unmapped) + '\n  ]\n}\n'
(ROOT / 'data/versification/kjv-jps1917.v1.json').write_text(text)
print(len(entries), 'mapping groups;', len(unmapped), 'explicitly unmapped verses')
