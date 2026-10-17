"""Write the demo log served by the site's "Try a demo session" button from the anonymized fixture.

Usage: uv run python -m pokernow_analyzer.make_demo ../fixtures/sample.json ../frontend/public/poker_now_log_demo.csv
"""

import csv
import json
import sys
from pathlib import Path

entries = sorted(json.loads(Path(sys.argv[1]).read_text()), key=lambda e: int(e["created_at"]), reverse=True)
with open(sys.argv[2], "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["entry", "at", "order"])  # same columns and newest-first order as PokerNow's download
    for e in entries:
        w.writerow([e["msg"], e["at"], e["created_at"]])
