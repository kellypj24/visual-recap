# Panel

## Purpose

The Recap pane opened with `/visual-recap`: the session's totals as bars, then a timeline of turns. It answers "what kind of work has been done", so its totals are the work-mix totals in `time-accounting`.

## Boundaries

This spec covers the panel's totals. How time is counted belongs to `time-accounting`, and how categories look to `appearance`. The timeline of turns and its descriptions are outside this spec.

## Requirements

### Requirement: Work-mix totals with a Subagents row

The system shall draw the panel's totals as the work-mix totals in `time-accounting`: one row per main-loop category, adding up to the session's main-loop active time, then a separate Subagents row beneath them.

#### Scenario: Subagents worked longer than the session

- GIVEN a 5-minute session in which the main loop ran Shell throughout and two subagents each ran for the whole 5 minutes
- WHEN the panel draws
- THEN the main-loop rows show Shell 5m, and a separate Subagents row beneath them shows 10m

#### Scenario: No subagents

- GIVEN a session in which no subagent ran
- WHEN the panel draws
- THEN no Subagents row is drawn

## Known discrepancies

None recorded.

## Open questions

None.
