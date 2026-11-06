# GunsNPrices for Obsidian

Spec tables for gun and ammo listings, an ammo purchase log that totals rounds and cost per round, and a command
that cleans up caliber names. Write product titles the way stores write them; the plugin reads brand, model,
caliber, magazine capacity, barrel length and rounds per box.

It runs the [`gunsnprices`](https://www.npmjs.com/package/gunsnprices) title parser, the one behind the price
comparison site [GunsNPrices](https://gunsnprices.com), entirely inside Obsidian. No account, no API key, and it
works offline.

## Spec tables: `gunspecs`

One product title per line. Add a price with a currency symbol (`$18.99`) or after a `|`, and ammo gets a cost per
round.

````markdown
```gunspecs
Federal 9mm 115gr 50rd $18.99
Glock 19 Gen 5 MOS 9mm 4.02" 15rd Pistol
```
````

renders a table for each title:

| Federal 9mm 115gr 50rd | |
|---|---|
| Type | Ammo |
| Caliber | 9×19mm Parabellum |
| Rounds per box | 50 |
| Price | $18.99 |
| Cost per round | $0.38 |

| Glock 19 Gen 5 MOS 9mm 4.02" 15rd Pistol | |
|---|---|
| Type | Firearm |
| Brand | Glock |
| Model | Glock 19 Gen 5 MOS |
| Configuration | MOS |
| Caliber | 9×19mm Parabellum |
| Capacity | 15 rounds |
| Barrel | 4.02" |

Add `layout: compare` to put every product in one table, which is handy for comparing offers:

````markdown
```gunspecs
layout: compare
Federal 9mm 115gr FMJ 50rd $18.99
Winchester 9mm 115gr FMJ 1000 Round Case $289.99
```
````

| Product | Caliber | Rounds | Price | Per round |
|---|---|---|---|---|
| Federal 9mm 115gr FMJ 50rd | 9×19mm Parabellum | 50 | $18.99 | $0.38 |
| Winchester 9mm 115gr FMJ 1000 Round Case | 9×19mm Parabellum | 1,000 | $289.99 | $0.29 |

Lines starting with `#` or `//` are ignored.

## Ammo log: `ammo-log`

One purchase per line: an optional date, what you bought, and the price.

````markdown
```ammo-log
2026-10-20 | Federal 9mm 115gr FMJ 50rd x4 | $18.99
2026-10-25 | CCI Blazer Brass .45 ACP 230gr FMJ 50rd | $27.49
2026-11-01 | Winchester 9mm 115gr FMJ 1000 Round Case | $289.99 total
```
````

| Date | Ammo | Caliber | Boxes | Rounds | Paid | Per round |
|---|---|---|---|---|---|---|
| 2026-10-20 | Federal 9mm 115gr FMJ 50rd | 9×19mm Parabellum | 4 | 200 | $75.96 | $0.38 |
| 2026-10-25 | CCI Blazer Brass .45 ACP 230gr FMJ 50rd | .45 ACP | 1 | 50 | $27.49 | $0.55 |
| 2026-11-01 | Winchester 9mm 115gr FMJ 1000 Round Case | 9×19mm Parabellum | 1 | 1,000 | $289.99 | $0.29 |
| **Total** | | | **6** | **1,250** | **$393.44** | **$0.31** |

With more than one caliber, a second table shows each caliber's rounds, money and average cost per round
(here 9×19mm Parabellum: 1,200 rounds, $365.95, $0.30 per round).

How lines are read:

- **Boxes:** `x4`, `× 4`, `4x`, `4 boxes` or `qty 4`. The `x 19` in `9 x 19` is not taken as a box count.
- **Price:** the price of one box. Write `total` after it (`$75.96 total`) when it is the price of all boxes.
- **Rounds:** read from the title (`50rd`, `20 rounds`, `box of 25`, `1000 Round Case`, `50/box`). Lines without a
  round count still count toward money spent, but are left out of the average, and the block says so.
- The `|` separators are optional: `2026-10-20 Federal 9mm 50rd $18.99` works too. Prices use a dot for decimals.

## Command: normalize caliber in selection

Select caliber names and run **Normalize caliber in selection** from the command palette. Each line, table cell or
comma-separated item that is only a caliber is rewritten to one standard name out of 293 calibers:

| Selected | Becomes |
|---|---|
| `9mm Luger` | `9×19mm Parabellum` |
| `300 BLK` | `.300 AAC Blackout` |
| `caliber: 6.5 CM` | `caliber: 6.5mm Creedmoor` |
| `\| 7.62x39 \| 30-06 \|` | `\| 7.62x39mm \| .30-06 Springfield \|` |

Text that holds more than a caliber, such as `9mm 115gr FMJ` or `9mm +P`, is left alone, so the command never
drops words. The command has no default hotkey; you can assign one in **Settings → Hotkeys**.

## Settings

- **Link calibers to price pages** (off by default): caliber names in rendered blocks become links to that
  caliber's price comparison page on gunsnprices.com.
- **Currency symbol** (default `$`): shown before prices and cost per round. Prices in notes are read with this
  symbol or with `$`.

## Network use and privacy

- The plugin makes **no network requests**. All parsing happens on your device with data bundled in `main.js`.
- **No telemetry, no analytics, no ads, no account.**
- The only link to an outside site is the optional caliber link described above. It is off by default, and nothing
  is loaded until you click a link.
- It reads only the code blocks and the selection you run it on, and changes text only when you run the command.

## Install

From Obsidian: **Settings → Community plugins → Browse**, search for "GunsNPrices", install and enable.

Manually: copy `main.js`, `manifest.json` and `styles.css` from the
[latest release](https://github.com/gunsnprices/obsidian-gunsnprices/releases) into
`<your vault>/.obsidian/plugins/gunsnprices/`, then enable the plugin in **Settings → Community plugins**.

Works on desktop and mobile. On iOS it needs iOS 16.4 or later, because the parser uses regular expression
features that older iOS versions lack.

## Size

`main.js` is about 450 KB (about 80 KB gzipped). Most of it is data: 293 calibers with their store spellings and
the model dictionaries for 50 firearm brands. The data is loaded once when the plugin starts.

## Development

```bash
npm install
npm run dev     # watch build into main.js
npm run build   # type check + production build
npm run lint    # eslint with eslint-plugin-obsidianmd
npm test        # type check tests + vitest
```

## License

MIT. The caliber and model data come from the `gunsnprices` package (CC BY 4.0, attribution: GunsNPrices).
