# Time accounting

## Purpose

How the session's time is shared out among categories (Thinking, Reading, Editing, Shell, Web, Subagents, Asking you, Other tools). The band and the panel draw from it. There are two ways of counting: wall clock, where each second of the session counts once, and work mix, where the main loop's time is counted on its own and subagent work is added on top. The main loop is the agent the person talks to; a subagent is one it launches.

## Boundaries

This spec covers which category a span of time counts toward. How the totals are drawn belongs to `band` and `panel`, and how categories look to `appearance`. Which tool belongs to which category is decided in the code (`catOf` in `hooks/recap.ts`) and is outside this spec.

## Requirements

### Requirement: Wall-clock attribution puts the main loop first

The system shall count each second of the session once in wall-clock totals: to the main loop's running tools; else to Thinking while a main-loop turn is open; else to Subagents while any subagent runs; else to waiting on you.

#### Scenario: A background subagent while the main loop thinks

- GIVEN a background subagent launched by turn 1, still running after turn 1 ended
- WHEN turn 2 thinks for 4 seconds and then runs Bash for 6 seconds, the subagent running throughout
- THEN wall-clock totals for those 10 seconds are Thinking 4s and Shell 6s, and Subagents 0s

#### Scenario: A background subagent while you are away

- GIVEN a background subagent still running after the turn that launched it ended
- WHEN 30 seconds pass with no main-loop turn open, the subagent running throughout
- THEN those 30 seconds count as Subagents, not waiting on you

### Requirement: Work-mix totals count subagent work on top

The system shall total work-mix time as the wall-clock main-loop totals plus a Subagents total that sums each subagent's own run time, counting overlapping subagents each in full.

#### Scenario: Two subagents beside the main loop

- GIVEN 5 minutes in which the main loop runs Shell throughout and two subagents each run for the whole 5 minutes
- WHEN work-mix totals are computed
- THEN Shell is 5 minutes and Subagents is 10 minutes

### Requirement: Permission prompts count as Asking you

Where the end of a permission prompt can be timed reliably, the system shall count the time a main-loop tool call waits on its permission prompt as Asking you, and only the time after it is answered as the tool's own category.

#### Scenario: A Bash call that waits for approval

- GIVEN a main-loop Bash call whose permission prompt is open for 20 seconds before it is approved
- WHEN the command then runs for 5 seconds
- THEN Asking you gains 20 seconds and Shell 5 seconds

## Known discrepancies

None recorded.

## Open questions

- Can the end of a permission prompt be timed reliably? The probe in change 261020-0z6h5 (its `implementation.md`, T-04) found no event that marks when a prompt is answered: `tool.check` resolves before the dialog opens and its `ask` may go to a classifier or a host, `classic.PermissionRequest` has no `tool_use_id`, and `classic.PostToolUse.duration_ms` arrives only after the tool ends. Until one is found, the condition of "Permission prompts count as Asking you" is not met, and a call's time includes its prompt.
