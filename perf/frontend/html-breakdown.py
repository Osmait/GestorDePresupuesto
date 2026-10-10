#!/usr/bin/env python3
"""Breaks down a server-rendered App Router HTML document: visible markup vs the
inlined RSC flight payload (self.__next_f.push), message catalogs, and how many
times seed transactions appear (to spot data serialized but never shown).

    python3 perf/frontend/html-breakdown.py page.html [more.html ...]
"""
import re
import sys

for f in sys.argv[1:]:
    html = open(f, encoding='utf-8').read()
    total = len(html.encode())
    pushes = re.findall(r'self\.__next_f\.push\((\[.*?\])\)</script>', html, re.S)
    flight = sum(len(p.encode()) for p in pushes)
    body_markup = total - flight
    tx_names = len(re.findall(r'(Gasto|Ingreso) #\d+', html))
    tx_desc = len(re.findall(r'Perf seed transaction', html))
    # next-intl messages are passed to NextIntlClientProvider: look for a long known key
    msgs = 0
    m = re.search(r'\\"messages\\":\{', html)
    if m:
        # rough: from the messages key to the end of its push
        start = m.start()
        end = html.find('</script>', start)
        msgs = len(html[start:end].encode())
    print(f'== {f.split("/")[-1]}: total {total/1024:.1f} KB, flight payload {flight/1024:.1f} KB ({len(pushes)} pushes), '
          f'markup+other {body_markup/1024:.1f} KB, tx names x{tx_names}, tx descriptions x{tx_desc}, '
          f'messages chunk ~{msgs/1024:.1f} KB')
