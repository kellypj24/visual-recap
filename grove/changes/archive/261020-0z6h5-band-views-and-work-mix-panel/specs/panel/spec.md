# Changes to panel

The changes that change 261020-0z6h5 proposes to the requirements of `panel`, the Recap pane opened with `/visual-recap`. This is future work. There is no maintained spec for `panel` at 46b9563, so every requirement is ADDED, and today's behavior is described under "Observed current behavior".

## ADDED Requirements

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

## Observed current behavior

Evidence, not agreement. At `043bdec` (`origin/main`):

- The panel draws one bar per category from the same totals as the band, Subagents among them, with percentages of their sum (`hooks/register.tsx`, the `Pane` hook, lines 307-345).
- Time between turns is shown as a "Waiting on you" row when it reaches a second.
