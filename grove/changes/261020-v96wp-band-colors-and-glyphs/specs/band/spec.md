# Changes to band

The changes that change 261020-v96wp proposes to the requirements of `band`, the strip and totals drawn above the prompt. This is future work. There is no maintained spec for `band` at 46b9563, so every requirement is ADDED, and today's behavior is described under "Observed current behavior". Change `261020-5e6me` also adds requirements to `band`; this change builds on them.

## ADDED Requirements

### Requirement: Done state keeps the strip's height

When the agent stops working, the system shall keep the strip at the height it had while working, draw it dimmed, and show how the turn ended beside the totals.

#### Scenario: A turn ends

- GIVEN the band drawing a working strip with Shell and Thinking blocks
- WHEN the turn completes
- THEN the strip keeps the same glyphs and height, drawn dimmed, and the line beneath reads `✓ Done in` followed by the turn's duration

#### Scenario: Working again

- GIVEN a dimmed strip after a turn ended
- WHEN the person starts the next turn
- THEN the strip is drawn at full strength again, with the pulsing leading edge and the spinner

## Observed current behavior

Evidence, not agreement. At `043bdec` (`origin/main`):

- While working, the strip is drawn in `▆` with a pulsing leading edge and a spinner. Once done it drops to `▂` and the line reads `✓ Done in …` or `✓ Interrupted after …`, followed by `· waiting on you` (`hooks/register.tsx:265-304`).
- The README describes this: "When the agent stops, the strip drops to a thin line" (`README.md:9`).
