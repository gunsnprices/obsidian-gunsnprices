# Changelog

## 0.1.0 (2026-11-07)

First release.

- `gunspecs` code block: a spec table per product title (type, brand, model, configuration, features, caliber,
  capacity, barrel, rounds per box, price, cost per round); `layout: compare` for one comparison table.
- `ammo-log` code block: purchases with box counts and prices, totals for rounds, money and average cost per round,
  and a per-caliber summary.
- Command "Normalize caliber in selection": rewrites caliber names to one of 293 standard names and leaves any other
  text alone.
- Settings: optional links from calibers to GunsNPrices price comparison pages (off by default), currency symbol.
- Works offline: no network requests, no telemetry.
