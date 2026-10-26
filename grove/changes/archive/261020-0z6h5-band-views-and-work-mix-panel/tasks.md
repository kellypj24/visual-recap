## T-01 — Wall-clock attribution with the main loop first

Result: wall-clock totals and the band's wall-clock strip follow "Wall-clock attribution puts the main loop first" in [specs/time-accounting/spec.md](specs/time-accounting/spec.md).

Constraints: needs PR #5's subagent spans merged.

Acceptance:
- Unit tests in `tests/recap.test.ts` cover both of that requirement's scenarios.
- A render test replays a background subagent across two turns and finds the band's totals match the first scenario, on terminal and desktop.

## T-02 — Work-mix totals in the panel

Result: the panel follows [specs/panel/spec.md](specs/panel/spec.md), using the work-mix totals in [specs/time-accounting/spec.md](specs/time-accounting/spec.md).

Acceptance:
- A unit test covers "Two subagents beside the main loop".
- A render test mounts the panel on terminal and desktop and finds the separate Subagents row in the first scenario, and no Subagents row in the second.

## T-03 — Band views and switching

Result: the band follows every requirement in [specs/band/spec.md](specs/band/spec.md): the two views, the legend button and letter, `/visual-recap view wall|work`, and the band view setting in `.claude-plugin/plugin.json`.

Acceptance:
- Render tests on terminal and desktop draw both views, switch by pressing the legend button, and switch by running the command mid-turn.
- `/visual-recap` with no argument still opens the panel.
- `types/index.d.ts` declares any new state key.
- `claude plugin validate .`, `claude plugin test .` and `npx -p typescript tsc -p .` pass.

## T-04 — Permission prompts as Asking you

Result: either main-loop permission prompts count as "Permission prompts count as Asking you" in [specs/time-accounting/spec.md](specs/time-accounting/spec.md) requires, or a probe shows their end can't be timed reliably and the change records that and leaves counting as it is.

Constraints: blocked on the open question in [proposal.md](proposal.md) until the probe answers it.

Acceptance:
- The probe's findings (which events mark a prompt's start and end, for which tools) are recorded in this change's `implementation.md`.
- If implemented: a render test drives a Bash call whose permission prompt waits, and finds the wait under Asking you and the run under Shell.

## T-05 — README and images

Result: the README explains both views, the panel's Subagents row, how to switch views, the band view setting, and, if T-04 was implemented, that permission prompts count as Asking you. The README images are redrawn.

Acceptance:
- `README.md`'s "How time is counted" and settings table match the new behavior, and `CLAUDE.md`'s conventions match how subagent time is counted.
- `docs/mockups.mjs` draws the wall-clock band, the work-mix band and the new panel, it has been run, and the regenerated SVGs have been checked in a browser.
