# Changes to band

The changes that change 261020-5e6me proposes to the requirements of `band`, the strip and totals drawn above the prompt. This is future work. There is no maintained spec for `band` at 46b9563, so every requirement is ADDED, and today's behavior is described under "Observed current behavior".

## ADDED Requirements

### Requirement: Fixed column scale between rescales

While the session's active time fits in the strip's width at the current scale, the system shall keep the time each column stands for unchanged, so blocks already drawn keep their position and width as time passes.

#### Scenario: A second passes on a bar with room

- GIVEN an 80-column strip at 1 second per column, holding 40 seconds of active time
- WHEN the 41st second of active time is recorded
- THEN the first 40 columns are drawn exactly as before, and the 41st column takes the live block's category

### Requirement: Double the scale when the bar is full

When the session's active time exceeds the strip's width times the current scale, the system shall double the scale as many times as needed for the whole session to fit.

#### Scenario: The bar fills up

- GIVEN an 80-column strip at 1 second per column, holding 80 seconds of active time
- WHEN the 81st second of active time is recorded
- THEN the strip is redrawn at 2 seconds per column, every block about half its former width, and the whole session still visible

#### Scenario: A long session on a fresh band

- GIVEN a session with 10 minutes of active time and an 80-column strip being drawn for the first time
- WHEN the band draws
- THEN the scale is the smallest step of the ladder at which 10 minutes fits in 80 columns (8 seconds per column with a ladder from 1 second)

### Requirement: Whole-block columns

The system shall give each block of the strip a whole number of columns that differs from its exact share of the filled width by less than one column, with the columns adding up to the filled width.

#### Scenario: Two blocks that would split a column

- GIVEN a strip at 1 second per column holding 10.5 seconds of Thinking followed by 10.5 seconds of Shell
- WHEN the band draws
- THEN Thinking has 10 or 11 columns, Shell has the rest of the 21 columns, and every column belongs to exactly one block

#### Scenario: No flicker between redraws

- GIVEN a strip whose scale does not change between two redraws, and no new block between them
- WHEN the band draws twice in a row
- THEN the edges between blocks other than the live one are in the same columns both times

## Observed current behavior

Evidence, not agreement. At `043bdec` (`origin/main`; `hooks/recap.ts` matches `46b9563`):

- `strip()` (`hooks/recap.ts:71-92`) divides all active time across the full width on every call, so a column's duration changes with each new second.
- Each column takes the category that filled most of its slice; a column with nothing in it repeats the previous one (`hooks/recap.ts:87-91`).
- The band passes `strip()` its full width, minus one column for the pulsing leading edge while working (`hooks/register.tsx:271` at `043bdec`).
- The panel's per-turn bars call `strip()` for each turn, at up to 24 columns (`hooks/register.tsx:317-322` at `043bdec`).
- The README says "Each cell of a strip takes the color of whatever filled most of that slice of time" (`README.md:61` at `043bdec`).
