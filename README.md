# PokerNow Session Analyzer

Upload PokerNow logs, get every hand and per-player stats (VPIP, PFR, 3-bet, fold to PFR/3-bet, AF, WTSD, W$SD),
nemesis / best friend, and archetype badges.

It is a static site: the Python analysis runs in the browser under [Pyodide](https://pyodide.org), so there is no
server and the log files never leave the device.

## Run locally

Requires Python 3.12 + [uv](https://docs.astral.sh/uv/) (to build the Python wheel) and Node 16+.

    cd frontend
    npm install
    npm run dev        # builds the wheel, then Vite dev server at http://127.0.0.1:5173/

or `npm run build` and serve `frontend/dist/` with any static file server, e.g.
`python3 -m http.server 8000 --bind 127.0.0.1 --directory frontend/dist`.

Tests: `cd backend && uv run pytest`. The frontend render check (no browser needed):

    cd backend && uv run python -m pokernow_analyzer.dump ../fixtures/sample.json > /tmp/session.json
    cd ../frontend && node scripts/render-check.mjs /tmp/session.json

Avatar sprites live in `frontend/src/sprites.js`; preview the sheet with `node scripts/sprite-sheet.mjs /tmp/sprites.png 10`.

The "Try a demo session" button loads `frontend/public/poker_now_log_demo.csv`, generated from the anonymized fixture:
`cd backend && uv run python -m pokernow_analyzer.make_demo ../fixtures/sample.json ../frontend/public/poker_now_log_demo.csv`.

## Deploy

`.github/workflows/pages.yml` runs the tests, builds the wheel and the site, and publishes `frontend/dist` to
GitHub Pages on every push to `main`. One-time setup in the GitHub repo: Settings → Pages → Source: *GitHub Actions*.
The site then lives at `https://<user>.github.io/<repo>/`. Pyodide (~10 MB) is fetched from jsdelivr on first visit
and cached by the browser afterwards.

## Getting a log

In the PokerNow room, open the ledger and click *Download log*. That gives `poker_now_log_<room>.csv`
(columns `entry,at,order`). Drop one or more on the start screen. Each download carries the downloader's own
hole cards (`Your hand is ...`), so ask the other players for their export of the same game too: the hands are
the same, and every extra file reveals one more player's cards in every hand. The first file's downloader is "you".

Why no room-code lookup: PokerNow's live log endpoint pages 50 lines at a time behind a rate limit
(~35 s for a 60-hand session) and stops serving the log once a game finishes; the one-shot CSV
download is guarded by a Cloudflare Turnstile captcha, which only a browser can pass.

## Layout

- `backend/pokernow_analyzer/parser.py` – log lines → `Hand` (seats, ordered actions with chips added, board, shown cards, collected, positions)
- `backend/pokernow_analyzer/stats.py` – per-player stats, definitions in the module docstring
- `backend/pokernow_analyzer/aliases.py`, `archetypes.py` – player merging, badges
- `backend/pokernow_analyzer/profile.py`, `reads.py` – per-player deep dive (preflop habits, street action mix and sizing, what shown bets meant) and rule-based reads
- `backend/pokernow_analyzer/analyze.py` – `analyze_json`, the entry point the browser calls; pure stdlib
- `frontend/src/analyzer.js` – loads Pyodide + the wheel, calls `analyze_json`
- `frontend/src/` – upload → players → player hands → hand detail (text; replay to come)
- `fixtures/` – an anonymized 63-hand session (fake names and ids, real action) used by the tests and the render check

## License

AGPL-3.0. Free to use, modify and self-host; if you run a modified version for others, publish your changes under the same license.
