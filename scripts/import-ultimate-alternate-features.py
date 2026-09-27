#!/usr/bin/env python3
"""Validate the Ultimate SRD ACF index against curated mechanics, then emit catalog JSON.

python scripts/import-ultimate-alternate-features.py --cache /path/to/html/cache [--check]
Cache filenames replace URL slashes with underscores, e.g. srd_classes_baseCore_fighter.html.
No source prose is copied into the generated catalog. Rule mapping is reviewed separately.
"""
import argparse
import html
import json
import re
from pathlib import Path
from urllib.parse import urljoin

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://srd.dndtools.org/'

def index_links(raw):
    links = []
    for cell in re.findall(r'<td\b[^>]*>(.*?)</td>', raw, re.S | re.I):
        if re.search(r'(?:Alternative|Alternate) Class Features', cell, re.I):
            links += re.findall(r'<a[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', cell, re.S | re.I)
    return links

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache', type=Path, required=True)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    rules = json.loads((ROOT / 'scripts/data/alternate-feature-rules.json').read_text())
    pages = json.loads((ROOT / 'scripts/data/alternate-feature-coverage.json').read_text())
    by_id = {r['id']: r for r in rules}
    assert len(by_id) == len(rules), 'Duplicate rule ID'
    seen = set()
    cached = {p.name for p in args.cache.glob('srd_classes_base*.html')}
    expected = {p['source'].removeprefix(BASE).replace('/', '_') for p in pages}
    assert cached == expected, f'Base-class page coverage changed: missing {expected-cached}, extra {cached-expected}'
    for page in pages:
        raw = (args.cache / page['source'].removeprefix(BASE).replace('/', '_')).read_text()
        links = index_links(raw)
        assert len(links) == page['alternatives'], f"Index count changed: {page['classId']}"
        for href, title in links:
            url = urljoin(page['source'], html.unescape(href))
            target, anchor = url.split('#')
            rule_id = page['classId'] + '-' + anchor
            assert rule_id not in seen, f'Duplicate indexed feature: {rule_id}'
            seen.add(rule_id)
            assert rule_id in by_id, f'Unmapped source entry: {rule_id}'
            rule = by_id[rule_id]
            assert rule['source'] == url, f'Source changed: {rule_id}'
            assert rule['classId'] == page['classId'], f'Class mismatch: {rule_id}'
            assert rule['name'] == html.unescape(re.sub('<[^>]+>', '', title)).strip(), f'Name changed: {rule_id}'
            section = (args.cache / target.removeprefix(BASE).replace('/', '_')).read_text()
            assert re.search(r'<a\b[^>]*(?:id|name)=["\']' + re.escape(anchor) + r'["\']', section, re.I), f'Missing anchor: {url}'
            assert rule['kind'] in ('replacement', 'optional', 'reference')
            assert rule['kind'] != 'replacement' or rule['replaces'], f'Missing replacement mapping: {rule_id}'
            assert 1 <= rule['level'] <= 20
    assert seen == set(by_id), f'Unindexed rules: {set(by_id)-seen}'
    serialized = json.dumps(rules, ensure_ascii=False, indent=2) + '\n'
    destination = ROOT / 'lib/alternate-feature-data.json'
    if args.check:
        assert destination.read_text() == serialized, 'Generated catalog differs; run without --check'
    else:
        destination.write_text(serialized)
    print(f'Validated {len(seen)} indexed entries across {len(pages)} base-class pages.')

if __name__ == '__main__':
    main()
