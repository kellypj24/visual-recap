# Band

## Purpose

The strip and totals drawn above the prompt. The band shows the whole session at once and answers "what is the agent's time going to right now" in its default wall-clock view; its work-mix view adds a second strip for subagents. Terms: a block is a run of one category in a strip; the scale is the time one column stands for; the view letter is `v`; the band view setting is `bandView` in `/config`, with values `wall` and `work`.

## Boundaries

This spec covers the band's strips, its totals line, its done state and how it switches views. How time is counted belongs to `time-accounting`, and how categories look to `appearance`. Collapsing and focusing the band are Claude Code's own (ctrl+x ctrl+a, its `[-]` mark, ctrl+x tab) and outside this spec.

## Requirements

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

### Requirement: Wall-clock view by default

Where the band view setting is unset or holds an unrecognized value, the system shall draw the band in the wall-clock view, its strip and totals following the wall-clock attribution in `time-accounting`.

#### Scenario: A fresh install

- GIVEN the plugin installed with no band view setting
- WHEN the band draws
- THEN it shows one strip of wall-clock time and the wall-clock totals

### Requirement: Work-mix view

While the band is in the work-mix view, the system shall draw two strips on the same time scale, the main loop's on top and one marking when any subagent ran beneath it, followed by the work-mix totals.

#### Scenario: A subagent beside the main loop

- GIVEN a session in which a subagent ran during the second half of a turn
- WHEN the band draws in the work-mix view
- THEN the lower strip is filled under the second half of that turn and empty elsewhere, and the totals include a Subagents total that adds to the main-loop totals

### Requirement: Switch views from the band

When the person clicks the band's legend, or presses the view letter while the band has focus, the system shall switch the band to the other view.

#### Scenario: Clicking the legend

- GIVEN the band in the wall-clock view
- WHEN the person clicks the legend line
- THEN the band redraws in the work-mix view, and clicking again returns it to the wall-clock view

### Requirement: Switch views by command

When the person runs `/visual-recap view wall` or `/visual-recap view work`, the system shall draw the band in the view named, and shall leave the band as it is and say which views exist when the argument names neither.

#### Scenario: Switching mid-turn

- GIVEN a turn running with the band in the wall-clock view
- WHEN the person runs `/visual-recap view work`
- THEN the band redraws in the work-mix view without waiting for the turn to end

### Requirement: Default view in /config

The system shall offer a band view setting in `/config` whose value, `wall` or `work`, chooses the view the band starts a session in.

#### Scenario: Work mix as the default

- GIVEN the band view setting set to `work`
- WHEN a new session starts
- THEN the band draws in the work-mix view

## Known discrepancies

None recorded.

## Open questions

None.
