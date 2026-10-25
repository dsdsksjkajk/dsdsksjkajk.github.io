#!/usr/bin/env python3
"""Fetch market.flatmmo.com's Recent trades table, merge new rows into
flatmmo/trades.json, and leave the file untouched (and exit nonzero) if
anything looks wrong. Stdlib only — no pip install needed in the Action."""
import html.parser
import json
import re
import sys
import urllib.request
import urllib.error
from datetime import datetime, timezone

SOURCE_URL = "https://market.flatmmo.com/market/listing/all/view/"
TRADES_JSON = "flatmmo/trades.json"
MIN_ROWS = 10  # sanity floor: fewer than this means the page shape probably changed


class TableRowExtractor(html.parser.HTMLParser):
    """Collects <tr> -> [cell text, ...] for every row inside one <table>."""
    def __init__(self):
        super().__init__()
        self.rows = []
        self._row = None
        self._cell_parts = None
        self._in_cell = False

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self._row = []
        elif tag == "td":
            self._in_cell = True
            self._cell_parts = []

    def handle_endtag(self, tag):
        if tag == "td" and self._in_cell:
            text = " ".join(self._cell_parts).strip()
            text = re.sub(r"\s+", " ", text)
            self._row.append(text)
            self._in_cell = False
            self._cell_parts = None
        elif tag == "tr" and self._row is not None:
            if self._row:
                self.rows.append(self._row)
            self._row = None

    def handle_data(self, data):
        if self._in_cell:
            self._cell_parts.append(data)


def extract_recent_trades_table(page_html):
    """Find the <table> that follows the 'Recent trades' heading text and
    return its raw HTML slice. Anchoring on the heading (not table position)
    survives the page gaining/losing other tables."""
    marker = re.search(r"recent\s+trades", page_html, re.IGNORECASE)
    if not marker:
        raise ValueError("couldn't find a 'Recent trades' heading on the page")
    rest = page_html[marker.end():]
    table_start = rest.lower().find("<table")
    if table_start < 0:
        raise ValueError("no <table> found after the 'Recent trades' heading")
    rest = rest[table_start:]
    table_end = rest.lower().find("</table>")
    if table_end < 0:
        raise ValueError("'Recent trades' table was never closed")
    return rest[: table_end + len("</table>")]


def dedupe_name(name):
    """The site's markup has occasionally doubled an item's name in copy-paste
    exports (alt text + label); guard the same way here in case a scrape ever
    picks up both as one text run, e.g. 'bait bait' -> 'bait'."""
    parts = name.split()
    if len(parts) >= 2 and len(parts) % 2 == 0:
        half = len(parts) // 2
        if parts[:half] == parts[half:]:
            return " ".join(parts[:half])
    return name


def parse_price(text):
    t = re.sub(r"(?i)\s*each\s*$", "", text).strip()
    t = t.replace(",", "")
    if not re.fullmatch(r"\d+", t):
        return None
    return int(t)


def parse_qty(text):
    t = text.replace(",", "").strip()
    if not re.fullmatch(r"\d+", t):
        return None
    return int(t)


def rows_to_trades(rows):
    out, skipped = [], 0
    for cells in rows:
        if len(cells) < 4:
            skipped += 1
            continue
        name_raw, qty_raw, date_raw, price_raw = cells[0], cells[1], cells[2], cells[3]
        item = re.sub(r"[_\s]+", "_", dedupe_name(name_raw).strip().lower()).strip("_")
        date = date_raw.strip()
        qty = parse_qty(qty_raw)
        price = parse_price(price_raw)
        if not item or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date) or qty is None or price is None or qty < 1 or price < 1:
            skipped += 1
            continue
        out.append((item, date, qty, price))
    return out, skipped


def fetch_page(url):
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; flatmmo-price-tracker-bot/1.0; "
                           "+https://github.com/dsdsksjkajk/dsdsksjkajk.github.io)",
            "Accept": "text/html",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        charset = resp.headers.get_content_charset() or "utf-8"
        return resp.read().decode(charset, errors="replace")


def load_existing(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return [tuple(r) for r in data.get("trades", [])]
    except FileNotFoundError:
        return []


def merge(existing, scraped):
    seen = set(existing)
    added = [r for r in scraped if r not in seen]
    combined = existing + added
    combined.sort(key=lambda r: r[1])  # by date
    return combined, added


def main():
    try:
        page = fetch_page(SOURCE_URL)
    except (urllib.error.URLError, TimeoutError) as e:
        print(f"FETCH FAILED: {e}", file=sys.stderr)
        return 1

    try:
        table_html = extract_recent_trades_table(page)
    except ValueError as e:
        print(f"PARSE FAILED: {e}", file=sys.stderr)
        return 1

    extractor = TableRowExtractor()
    extractor.feed(table_html)
    trades, skipped = rows_to_trades(extractor.rows)

    print(f"scraped {len(trades)} usable rows, skipped {skipped} unreadable rows")
    if len(trades) < MIN_ROWS:
        print(f"FAILED: only {len(trades)} rows parsed (floor is {MIN_ROWS}) "
              f"— the page layout may have changed; not touching trades.json", file=sys.stderr)
        return 1

    existing = load_existing(TRADES_JSON)
    combined, added = merge(existing, trades)
    print(f"existing {len(existing)} rows, {len(added)} newly added, {len(combined)} total")

    if not added:
        print("no new trades — leaving trades.json as is")
        return 0

    out = {
        "updatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "trades": [list(r) for r in combined],
    }
    with open(TRADES_JSON, "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"wrote {TRADES_JSON}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
