# Band views and work-mix panel

## Problem

The owner: "I had a session that had a sub agent running and it was waiting for it. It seemed like time was being counted nowhere." And: "I've come to realize how much of what is being displayed is my interpretation of what the correct way to bucket time is, and there likely isn't a single universal way."

What the code does at `043bdec` (`origin/main`, which includes today's #13 and #14):

- There is one way of counting. Each second goes to the main loop's running tools, split evenly when several run at once, or else to Thinking while a turn is open, or else to waiting (`sweep` in `hooks/recap.ts:37-60`). The band and the panel both draw from it.
- A background Agent call returns as soon as its subagent starts, so its own span is about 0 seconds. When the main turn ends, the subagent's remaining time is counted as waiting. The band leaves waiting out, so that time shows nowhere; the panel calls it "Waiting on you" (`hooks/register.tsx:218-233` and `hooks/recap.ts:72` at `043bdec`; measured in PR #5's description).
- A tool's span includes its permission prompt: `tool.call`'s `next` runs "the permission prompt, the tool itself" (`.claude-plugin/types/claude-code/index.d.ts:4044`). Time spent waiting on your approval counts as that tool, most often Shell.

## Intended outcome

- The band answers "what is the agent's time going to right now": wall-clock time, one bucket per second, the main loop first.
- The panel answers "what kind of work has been done": main-loop rows that add up to the session's active time, plus a row for subagent work that adds on top of it.
- The band can switch to the work-mix view, with a second row showing when subagents ran. Clicking the legend or pressing a letter while the band has focus switches it; a `/config` setting chooses the default, and a command switches it mid-session.
- Waiting on a permission prompt counts as Asking you, if its end can be timed reliably.

## Scope

### In scope

- How wall-clock time is shared out when a subagent overlaps the main loop.
- The panel's work-mix totals with a Subagents row.
- The band's two views, switching between them, the `/config` default and the command.
- Counting permission prompts as Asking you, subject to a probe.
- README and `docs/mockups.mjs` updates for all of the above.

### Out of scope

- Timing background subagents from their own start to finish. That is PR #5, a prerequisite (see Decisions), not part of this change.
- A band view that keeps the time spent waiting on you. The owner chose "c": "Out for now."
- Counting a subagent's own tool calls in their categories (its Bash as Shell). The owner chose the separate-row layout instead of this.
- The strip's scale and edges (change `261020-5e6me`), colors and glyphs (change `261020-v96wp`).

## Decisions

- **The band and the panel answer different questions.** Offered wall-clock, work mix, or both, the owner chose "c". Asked which surface shows which, the owner said "I think A": the band shows wall-clock time, the panel the work mix.
- **The band can switch views.** The owner: "it would be nice if we could toggle the band type between them."
- **A `/config` default plus a command.** The owner chose "a" (a `/config` setting for the default, plus a command to flip it during a session) and asked for a hotkey: "A hotkey to toggle this would be nice too." There is no global plugin shortcut, only a band `Button` whose `hotkey` works while the band has focus (`index.d.ts:1113-1121`). The owner chose "b": the legend itself is the button. The owner closed PR #4 rather than add a third way to collapse the band, since Claude Code's ctrl+x ctrl+a and `[-]` already do it, so this change adds no show/hide control.
- **The command is `/visual-recap view wall|work`.** Offered that name, the owner said "thats fine".
- **Subagents get their own row in the panel.** The owner chose "b": main-loop rows still add up to the session time, and subagent work is a separate row under them.
- **The work-mix band is a two-row timeline.** The owner chose "b": main loop on top, subagent work below, so the band is three rows tall in that view.
- **Permission prompts count as Asking you, if it can be done reliably.** The owner said "yes", then "If permission prompt is too flaky to do right we can leave it."
- **PR #5 is fixed up and merged first.** The owner: "#5 is part of the fix, but we need to fix it up first before merging it." The fixes needed are listed in the owner's review comment on PR #5.
- **This lands after `261020-5e6me`.** The owner chose to land the strip change first, since this change's three-row band draws on the strip.

## Open questions

Must be answered before T-04 can be built:

- Can the end of a permission prompt be timed reliably? `tool.check` resolves before the dialog opens (`index.d.ts:4056-4069`), and no declared event marks the moment it is answered. For Bash, `process.spawn` may stand in. T-04 begins with a probe; if the probe finds no reliable end, T-04 records that and changes nothing.

Can wait until review:

- Which letter switches the view while the band has focus. The draft assumes `v`.

## Assumptions to confirm in review

- While a main-loop turn is open, a second goes to the main loop's running tools, else Thinking. Subagents get a second only when no main turn is open and a subagent is running; only then is it not waiting on you. This follows the owner's review of PR #5, point 1.
- Parallel main-loop tools keep splitting their seconds evenly, as today.
- The view picked with a click, the letter or the command lasts until the session ends. The `/config` setting is what persists.
- In the panel, main-loop percentages are of main-loop active time, and the Subagents row shows its time without a percentage. The header shows both totals, e.g. `Session 9m · agent 6m · subagents 14m`.
- An unrecognized `/config` value falls back to the wall-clock view.

## Related documents

- Requirements:
  - [specs/time-accounting/spec.md](specs/time-accounting/spec.md)
  - [specs/band/spec.md](specs/band/spec.md)
  - [specs/panel/spec.md](specs/panel/spec.md)
- Tasks: [tasks.md](tasks.md)
- Prerequisite: PR #5, "fix: time background subagents from their own run", and the owner's review comment on it
