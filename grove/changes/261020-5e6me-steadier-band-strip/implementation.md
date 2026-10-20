# Implementation: Steadier band strip

<!-- Progress on change 261020-5e6me, written by whoever implements it. It is not
part of what was approved and does not amend it. If the owner drops the change,
write "Status: dropped" here with their reason. -->

## Assumptions used

- Ladder's first step (open question): 1 second per column, doubling (1 s, 2 s, 4 s, ...), as the draft assumes.
- Step zoom applies to the band only. The panel's per-turn bars stay fitted to their width and get whole-block columns from the shared `strip()`. Held as written.
- On a width change the scale is chosen again from the start of the ladder. Held as written: the scale is a pure function of active time and width (`scaleFor`), so a new width picks its own step with no stored state. Because active time only grows, the scale only moves when the bar is full, which is what keeps drawn blocks in place.
- Nothing in the code showed an assumption to be wrong. Side effect worth noting: the band is one column narrower while working (the pulsing edge), so at the very edge of a step, the scale can differ by one step between the working and stopped band. The one-column width difference already existed before this change.

## Tasks

### T-01 — Step-zoom strip with whole-block columns

Status: done

What changed:
- `hooks/recap.ts`: new `scaleFor(activeMs, width)`, the smallest of 1 s, 2 s, 4 s, ... per column at which the active time fits. `strip(pieces, width, zoom?)` now merges the active pieces into blocks (runs of one category, with parallel pieces splitting their time) and ends each block at column `round(time before its end / scale)`. Each block is then within one column of its exact share, the columns add up to the filled width, and the edges of finished blocks stay put while the scale holds. With `zoom`, the strip fills `max(1, round(active / scale))` columns from the left. Without it, the scale is `active / width` and the whole width is filled.
- `hooks/register.tsx`: the band calls `strip(..., true)`. The panel's per-turn bars call it unchanged (fitted).

Evidence (tests mapped to the band spec):
- Scenario "A second passes on a bar with room": `tests/recap.test.ts` "a second added with room left leaves the drawn columns alone" (40 s in 80 columns gives 40 columns, and 41 s keeps those 40 with column 41 in the live block's category).
- Scenario "The bar fills up": "a full bar doubles the scale and still shows the whole session" (80 s gives 40+40 at 1 s per column, and 81 s gives 2 s per column with 20+21).
- Scenario "A long session on a fresh band": "a long session on a fresh band takes the smallest step that fits" (10 min in 80 columns gives 8 s per column and 75 columns; a new width picks again from the start of the ladder).
- Scenario "Two blocks that would split a column": "blocks that would split a column get whole columns adding up to the filled width" (10.5 s + 10.5 s gives 11 + 10 of 21; a fitted bar gives 3/4/3 of 10).
- Scenario "No flicker between redraws": "redraws at the same scale keep the edges of finished blocks".
- Render: `tests/render.test.tsx` "a second later the band keeps the blocks it drew, on terminal and desktop" mounts the band at 9 s and at 10 s on both surfaces. It finds 9 then 10 columns (not stretched across 79), and the first 9 column colors are unchanged.
- The existing "the strip covers active time only, left to right" test (fitted, as the panel uses it) still passes.
- Checks: `claude plugin validate .` passes, `claude plugin test .` passes 12 of 12, and `npx -p typescript tsc -p .` reports no errors.

### T-02 — README and images for the new strip

Status: done

What changed:
- `README.md`: the majority-color sentence is replaced. The strip always shows the whole session, fills from the left at a fixed scale starting at one second per cell, and doubles the scale when the bar is full. Each block gets whole cells close to its share, and the panel's turn strips span their full width.
- `docs/mockups.mjs`: its `strip()` draws the new way. The band images use the zoom ladder and are partly filled at 2 s per cell, and the panel's turn bars are fitted with whole-block cells. Each word is still placed at its own column.
- Ran `node docs/mockups.mjs`, which regenerated `docs/band.svg`, `docs/band-done.svg` and `docs/panel.svg` (`docs/strip.svg` did not change). Previewed as PNG with `qlmanage`: they look right.
- Browser check: done. The four SVGs were rendered in headless Google Chrome and screenshotted; the partly filled band, done band, strip and panel all draw as intended, with no clipped or overlapping text.

## Reconciliation

<!-- One line per change spec, once applied to its maintained spec:

    - record-editing: applied to specs/record-editing/spec.md
-->
