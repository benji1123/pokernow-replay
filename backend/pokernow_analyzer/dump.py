"""Print the analyzed session for a fixture, for the frontend render check.
Usage: uv run python -m pokernow_analyzer.dump ../fixtures/sample.json > session.json
"""
import json
import sys
from pathlib import Path

from .analyze import build_session
from .parser import parse_json_entries

path = Path(sys.argv[1])
hands = parse_json_entries(json.loads(path.read_text()))
print(json.dumps(build_session([(path.stem, hands)])))
