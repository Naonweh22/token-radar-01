# Token launch radar

[![make.fun](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Naonweh22/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Naonweh22/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01)

A [make.fun](https://make.fun/bounty/token-radar-01) entry for the bounty
"Build the best token launch radar". It reads a sealed DefiLlama snapshot
of 758 protocols and ranks the 198 pre-token protocols (40 on the
watchlist, 158 more found below the $50M floor) by the implied value of
a token launch.

The model (radar-2) is a peer multiple: the median market-cap/TVL of
live-token protocols in the same category, capped at 0.5, times TVL,
adjusted for 7-day growth, maturity on the record, and chain reach. No
protocol name is special-cased. Each row carries a concrete farm plan
with costs and hold times.

Run it with Node 22:

    mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>

It writes `board.json`, `data.js`, `dashboard/` and `screenshots/` to the
output directory, plus `dossier.json`. Two runs write identical bytes.
No network is used.
