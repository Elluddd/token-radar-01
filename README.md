# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Elluddd/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Elluddd/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

The best token launch radar: it reads a sealed snapshot of every protocol DefiLlama
tracks, works out which ones still record no token and are not a wrapped or staked
product of one that trades, and ranks them by what their launch would be worth —
then hands in a web dashboard with the board, a detail view for each protocol and the
steps to farm it.

The model (radar-2) replaces a flat multiple with a market-calibrated one: each
category's multiple is the median market-cap-to-TVL ratio of its live tokens in the
snapshot itself, shrunk toward the market-wide median. Implied value is TVL times
that multiple times seven-day growth times maturity times chain breadth. No protocol
name is special-cased — the same function scores every row. The board covers the whole
40-protocol watchlist plus 138 early rows below the $50M floor: 178 rows, each with a
six-step farm plan that states its cost and time.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input path/to/snapshot.json
```

Node 22.18 or later, standard library only — nothing to install. In the grader the
snapshot is mounted at `/input/snapshot.json` and the output goes to `/output`. The run
is deterministic: two runs on the same snapshot write identical bytes.

## Layout

- `main.ts` — the entrypoint: reads the snapshot, builds the board, writes
  `board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json`.
- `lib/model.ts` — the radar-2 model, the farm plans and the board gate.
- `vendor/makefun-board.ts` — make.fun's dashboard-dossier library, as shipped in the kit.
- `dashboard/` — the static page (index.html, app.css, app.js), no network, no framework.
- `screenshots/` — the board, a protocol's detail view and a filtered view.

---

<sub>Entered on [make.fun](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
