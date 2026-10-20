# Steadier band strip

## Problem

The owner, about the band while a turn runs: "when the bar is moving, blocks of time are shrinking and growing as more time elapses to fit the time in the space. It doesn't feel the best."

Two things in the code cause it (`hooks/recap.ts`, at `043bdec`; that file is unchanged from `46b9563`):

- `strip()` (lines 71-92) spreads all of the session's active time across the band's full width on every redraw. As each second passes, every block is resized.
- Each column then takes the category that filled most of its slice (lines 87-91). When the scale shifts slightly, an edge between two blocks can flip a column back and forth, so edges jump.

## Intended outcome

The band still shows the whole session at once. Between rare rescales, blocks already drawn stay exactly where they are and only the newest block grows. A rescale happens only when the bar is full, and halves every block's width in one step. Each block gets a whole number of columns as close to its share of time as possible, so no edge flips between redraws.

## Scope

### In scope

- How the band's strip maps time to columns: a step-zoom scale, and columns given to whole blocks instead of decided column by column.
- The README's account of how the strip is drawn, and the README images.

### Out of scope

- A scrolling window or a band that shows only the current turn. The owner rejected both: "We need to be able to see the whole session at once."
- What counts as which category, and the band views. Both are in change `261020-0z6h5`.
- Colors, glyphs and the done-state look. Those are in change `261020-v96wp`.

## Decisions

- **The band always shows the whole session.** The owner: "We need to be able to see the whole session at once." This rules out a scrolling window or a per-turn band.
- **Step zoom plus steadier edges.** Offered "(d) leave the scaling alone and only cut the edge jitter" and "(b) step zoom", the owner answered "d + b". In the conversation this was read as using both, and the owner did not correct that reading.
- **This lands before `261020-0z6h5` and `261020-v96wp`.** Asked whether one of the three changes had to land first, the owner chose "3 first", since the two others both draw on the strip.

## Open questions

Can wait until review:

- The scale ladder's first step. The draft assumes 1 second per column, doubling from there. This settles the scale requirement's numbers, but no task waits on it.

## Assumptions to confirm in review

- Step zoom applies to the band only. The panel's per-turn bars stay fitted to their width, since a finished turn's bar never changes, but they get the same whole-block columns because they share `strip()`.
- When the band's width changes (a resized terminal), the scale is chosen again from the start of the ladder for the new width.

## Related documents

- Requirements: [specs/band/spec.md](specs/band/spec.md)
- Tasks: [tasks.md](tasks.md)
