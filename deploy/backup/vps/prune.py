"""Keeps 7 daily, 4 weekly and 6 monthly CanRush backups (canrush-YYYY-MM-DDTHHMMZ.tar.age): the newest copy of each
of the last 7 days, of the last 4 ISO weeks and of the last 6 months stays; the rest and their .sha256 go."""
import os, re, sys
from datetime import datetime

store = sys.argv[1]
copies = []
for name in os.listdir(store):
    m = re.fullmatch(r'canrush-(\d{4}-\d{2}-\d{2})T(\d{4})Z\.tar\.age', name)
    if m: copies.append((datetime.strptime(m[1] + m[2], '%Y-%m-%d%H%M'), name))
copies.sort(reverse=True)
keep = set()
for key, limit in ((lambda d: d.date(), 7), (lambda d: d.isocalendar()[:2], 4), (lambda d: (d.year, d.month), 6)):
    seen = []
    for when, name in copies:
        k = key(when)
        if k not in seen:
            seen.append(k)
            if len(seen) <= limit: keep.add(name)
for _, name in copies:
    if name not in keep:
        for path in (name, name + '.sha256'):
            try: os.remove(os.path.join(store, path))
            except FileNotFoundError: pass
