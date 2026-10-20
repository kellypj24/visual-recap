# Changes to time-accounting

The changes that change 261020-0z6h5 proposes to the requirements of `time-accounting`: how the session's time is shared out among categories. This is future work. There is no maintained spec for `time-accounting` at 46b9563, so every requirement is ADDED, and today's behavior is described under "Observed current behavior".

## ADDED Requirements

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

## Observed current behavior

Evidence, not agreement. At `043bdec` (`origin/main`):

- `sweep` gives each second to the open tool spans, split evenly among categories, else Thinking while a turn is open, else idle (`hooks/recap.ts:37-60`).
- Only main-loop tool calls are timed; a subagent's calls add to the turn's actions and return early (`hooks/register.tsx`, the `tool.call` hook).
- `turn.complete` closes every open span at the main turn's end (`hooks/register.tsx:218-233`).
- The time the model spends writing a tool call's arguments counts as that tool (the `turn.step` hook added by #13, `f05383b`).
- A tool's span runs from `tool.call` until its `next` resolves, which covers the permission prompt and the tool (`.claude-plugin/types/claude-code/index.d.ts:4044`).
- Asking you is the category of AskUserQuestion and ExitPlanMode only (`hooks/recap.ts:20`).
