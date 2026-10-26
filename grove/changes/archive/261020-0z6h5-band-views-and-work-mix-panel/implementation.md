# Implementation: Band views and work-mix panel

<!-- Progress on change 261020-0z6h5, written by whoever implements it. It is not
part of what was approved and does not amend it. If the owner drops the change,
write "Status: dropped" here with their reason. -->

Built on branch `feat/band-views`, which holds 261020-5e6me (step-zoom strip, not yet archived; the owner asked for this change to build on it as it is) and PR #16 (`fix/background-subagents`, the prerequisite the proposal calls PR #5). `grove instructions apply 261020-0z6h5` refuses while 261020-5e6me is not archived, so this file follows the template `grove instructions apply` prints for 261020-5e6me.

The proposal's "Assumptions to confirm in review" are followed as written. The open question "which letter" was left for review: the letter is `v`, as drafted. The `/config` setting is named `bandView`, values `wall` and `work`, default `wall`.

Rebased onto 261020-v96wp (`feat/band-colors-and-glyphs`, band colors and glyphs) so both changes' specs hold together. The work-mix band's second row, the work-mix legend's Subagents entry and the panel's Subagents row use v96wp's palette setting and glyphs (`▐` for Subagents), the second row is `mono` and dims with the strip when the agent stops, and the panel's bars keep v96wp's `·` track. The tests look up glyphs and colors through `CATS`; a new assertion checks the second row draws the Subagents glyph. PR #16 later gained a fix for a race in real Claude Code that left a subagent labelled "Subagent" (the label seen in the tmux session under T-03). With #15, #16 and #17 merged into main, this branch was rebuilt on main as two commits with the same content. Checks after the rebase: `claude plugin validate .` passed, `claude plugin test .` 33 pass, `npx -p typescript tsc -p .` clean; the five SVGs were regenerated and checked again in headless Chrome.

## Tasks

### T-01 — Wall-clock attribution with the main loop first

Status: done

PR #16 already gave `sweep` (`hooks/recap.ts`) this rule: main-loop tools, else Thinking while a main turn is open, else `agents` while a subagent run is open, else idle. Subagent runs are spans with `agentId`. This task added the tests the acceptance asks for and changed no counting.

- `tests/recap.test.ts`: "wall clock: a background subagent gets nothing while the main loop thinks or runs tools" (scenario "A background subagent while the main loop thinks": Thinking 4s, Shell 6s, no Subagents) and "wall clock: a background subagent while you are away counts as Subagents, not waiting" (scenario "A background subagent while you are away": 30 s of Subagents, no idle).
- `tests/render.test.tsx`: "the band's wall-clock totals give a background subagent only the time no main turn is open". Turn 1 launches a background subagent and ends; turn 2 thinks 4s and runs Bash 6s. On terminal and desktop the band shows Thinking 4s and Shell 6s and no Subagents total. After 30 s away it shows Subagents 30s.
- The existing PR #16 test "a background subagent is timed from its own run…" now checks its wall-clock numbers (Shell 6s, Thinking 6s, Subagents 9s) on the band, which is where wall clock is drawn now, on both surfaces. The panel is checked for the work mix (Subagents 20s, the subagent's whole run).

### T-02 — Work-mix totals in the panel

Status: done

- `hooks/recap.ts`: `workMix(spans, turns, from, to)` returns `{ main, subagents }`. `main` is `totals(sweep(...))` over main-loop spans only, idle dropped, so it adds up to the main loop's active time. `subagents` sums each subagent run's own time, clipped to the range, counting overlapping runs each in full.
- `hooks/register.tsx` panel: rows come from `workMix().main`. Percentages are of main-loop active time. Under them is a `Subagents` row with its time and no bar or percentage, drawn only when subagents worked at least 0.5 s, like the other rows. The header reads `Session 9m  agent 6m · subagents 14m · 3 turns`, with `· subagents …` only when subagents ran. The "Waiting on you" row is still the wall-clock idle time. Per-turn bars are unchanged (wall clock inside the turn).
- Tests: the unit test "work mix: main-loop rows add up to its own time and overlapping subagents each count in full" covers "Two subagents beside the main loop" with the scenario's 5 minutes: Shell 5 min, Subagents 10 min. It also checks that subagent time with no main turn open stays out of the main-loop rows. The render tests "the panel puts two subagents on their own row…" (scenario "Subagents worked longer than the session") and "the panel draws no Subagents row when no subagent ran" (scenario "No subagents") mount the panel on terminal and desktop. In them the scenario's 5 minutes is 5 seconds (Shell 5s, Subagents 10s). The band's 4 fps ticker makes mock-clock minutes slow: 5 minutes took about 7 s against a 5 s budget.

Interpretation calls:

- **A foreground Agent call next to the Subagents row.** The main loop's own Agent/Task/SendMessage span is main-loop time: the main loop is waiting on the call. So it stays a main-loop row, and the rows still add up to main-loop active time. It keeps category `agents` but is labeled **Agent calls** in the work mix (panel and work-mix band legend), so it isn't confused with the Subagents row of the subagents' own work. The wall-clock view keeps the label Subagents for it.
- **Wall-clock Subagents time is not main-loop time.** Time when no main turn is open and a subagent runs counts as Subagents in wall clock. It isn't in the work-mix main-loop rows, since they must add up to the main loop's own active time; the Subagents total covers it. So in the panel, session = main-loop active + subagent-only time + waiting on you, and the header shows agent (main loop) and subagents separately.

### T-03 — Band views and switching

Status: done

- `.claude-plugin/plugin.json`: `userConfig.bandView` is a string with `options: ["wall", "work"]` and default `wall`. The declarations (`PluginOptions`, index.d.ts ~7812) say a stored value outside `options` counts as unset, so the default applies. The hook also reads anything but `work` as `wall`.
- `types/index.d.ts`: `BandView` and the new state key `visual-recap.view: BandView | null`.
- `hooks/register.tsx`:
  - The `view` atom holds the pick made with the legend, the letter or the command; null means the `bandView` default. `session.end` sets it back to null, so a pick lasts until the session ends (a `/clear` or `/resume` starts the next session in the default). It is not saved to `$.store`, and since it lives in `$.state` it survives a module reload.
  - `setView($, to, fallback)` is a top-level function, called from the Button's `onPress` and from `command.run`. No render hook writes state.
  - Band, wall view: unchanged apart from the legend line becoming the Button.
  - Band, work view: `lanes()` (in `hooks/recap.ts`) splits the wall-clock strip's axis (any time the main loop or a subagent was busy) into a top row of main-loop categories, with `gap` where only subagents ran, and a lower row with `agents` wherever any subagent ran. Both go through `strip(..., true)`, which is now generic over its category type. Both rows cover the same active time, so they get the same `scaleFor` scale and filled width, and edges that line up in time land on the same column. Switching views keeps the time axis. `gap` columns draw as spaces. The totals are `workMix().main` (Agent calls named apart), then `Subagents <sum of runs>`. The band is three rows: main strip, subagent strip, legend line.
  - The legend line is `<Button key="view" hotkey="v" plain>` around the existing legend `Text`. A click, or `v` while the band has focus, toggles the view. Seen in a real terminal session (`claude --plugin-dir .` in tmux): the terminal draws it as `v: ✓ Done in 3s · waiting on you  ■ Thinking 3s`. Pressing ctrl+x tab then `v` toggled the view both ways, and `/visual-recap view work` switched it. A Button's children wrap instead of truncating, which put the legend on two rows when a docked panel narrowed the band. A `<Box height={1} overflow="hidden">` around the Button cuts it to one row. Clipping cuts at the row's end without the `…` that `wrap="truncate"` drew before.
  - `/visual-recap view wall|work` switches the view, even mid-turn: the command is `immediate`, and its `argumentHint` is `[view wall|work]`. `/visual-recap view <anything else>` (or `view` alone) leaves the band as it is and answers `Band views: wall (wall-clock time) or work (work mix). Try /visual-recap view work.` `/visual-recap` with no argument opens the panel as before; other arguments also still open it, as they did before.
  - To keep the rebase with 261020-v96wp tractable, the first strip row's and the legend's expressions are kept in place. Only a `gap` guard was added to the first row, a `mixLabel` choice and the work-mix `tot` to the legend, and the second row and the Button were added around them. The new JSX isn't re-indented. The second strip row repeats the first row's `(isWorking ? '▆' : '▂')` glyph choice, so v96wp's glyph and done-state changes need applying to both rows during the rebase.
- Tests (`tests/render.test.tsx`):
  - "the band switches between wall clock and work mix by its legend and by command, mid-turn". On terminal and desktop: 2 rows by default (wall); `press({ key: 'view' })` gives the work mix, whose lower strip is empty under the first 5 s of a 10 s turn and `CATS.agents.color` under the last 5 s, with totals `Thinking 10s  ■ Subagents 5s`; pressing again returns to 2 rows (scenario "Clicking the legend", requirement "Work-mix view", scenario "A subagent beside the main loop"). With the turn still open, `/visual-recap view work` redraws the mounted band in 3 rows; `view sideways` answers with the views and leaves it at 3; `view wall` gives 2 (scenario "Switching mid-turn"). `/visual-recap` with no argument opens the `visual-recap` pane, and the `view` runs opened nothing. After `session.end`, the next session draws the default again.
  - "with the band view setting at work a session starts in the work mix" (`options: { bandView: 'work' }`, both surfaces): scenario "Work mix as the default".
  - "an unrecognized band view setting draws the wall clock" (`options: { bandView: 'sideways' }`) and the default-options tests: requirement "Wall-clock view by default", scenario "A fresh install".
  - The unit test "work-mix lanes: the lower row fills only where a subagent ran, on the top row's axis" checks the rows' alignment against the wall-clock strip's length.
- Checks: `claude plugin validate .` passed with the same two warnings as before (CLAUDE.md at the plugin root; no icon), and now lists `visual-recap.view` among the state reads and writes. `claude plugin test .`: 26 pass, 0 fail. `npx -p typescript tsc -p .`: clean.

### T-04 — Permission prompts as Asking you

Status: done

Done as a probe: the end of a permission prompt can't be timed reliably, so counting is left as it is, as the task's Result allows. Time a main-loop call waits on its prompt still counts as the call's category. The README now says so ("A call's time includes any permission prompt it waits on").

Probe of `.claude-plugin/types/claude-code/index.d.ts` (Claude Code 2.1.305):

- **`tool.call`** (~4044): `next(e)` runs "the hooks beneath, then core (the permission prompt, the tool itself)". The span from the hook to `next` resolving covers both, with no event between them.
- **`tool.check`** (~4056, `ToolCheckInput`/`ToolCheckResult` ~13440-13560): fires for every tool (main loop: no `agentId`; carries `tool_use_id` on a real call). It fires "after the `tool.call` and PreToolUse hooks and before the mode settles an ask". A `decision: 'ask'` "puts it to the mode's decider (the dialog, the auto-mode classifier, a headless host)". So `ask` doesn't mean a dialog opens: in auto mode a classifier answers, and in `dontAsk` or headless runs nobody is asked. It can mark "an ask may start", not that a person was asked, and not when it ended.
- **`classic.PermissionRequest`** (`PermissionRequestHookInput` ~7667): fires wherever the engine runs the classic PermissionRequest hook, for any tool, so it can mark a dialog's start. Its input has `tool_name`, `tool_input` and `agent_id` (absent on the main loop), but no `tool_use_id`. Two parallel calls of one tool with the same input can't be told apart.
- **The end of a prompt:** no declared event marks the moment the person answers. The permission dialog "is drawn by the engine alone" (~9767): no `ui.render` component, and `$.ui.notice`'s line is removed by core "when the call resolves", with no event. `classic.PermissionDenied` is for auto-mode classifier denials.
- **`process.spawn`** (~3600, ~8250): this is `$.process.spawn`, a plugin's own child process ("above another plugin's spawn"). It isn't raised for the engine's Bash tool, so it can't stand in for a Bash call's start after approval, as the proposal hoped.
- **The only end signal is after the fact:** `classic.PostToolUse`/`PostToolUseFailure` carry `tool_use_id` and an optional `duration_ms`, "Tool execution time in milliseconds. Excludes permission-prompt and hook time." With it, `end - duration_ms` gives the moment the tool began. But it is only known once the tool has finished, and the field is optional. It also lumps PreToolUse/PostToolUse hook time and auto-mode classifier time in with the person's wait. Until the tool ends, the band would draw the run as Asking you and then redraw it as Shell.
- **The test kit can't simulate a prompt:** beneath the plugins, the test's own `tool.call` hook stands as core, so there is no engine dialog, no `tool.check` ask leading into one, and no `classic.*` ordering to check against.

Prompt start: `classic.PermissionRequest` (any tool, matched by name and input only), or `tool.check` → `ask` (any tool, by `tool_use_id`, but not always a person). Prompt end: none live; `classic.PostToolUse.duration_ms` afterwards, for calls that ran. If the owner wants it later, a retroactive split at PostToolUse (`classic.PermissionRequest` time to `end - duration_ms` as Asking you) is the path to try. Its limits are listed above.

### T-05 — README and images

Status: done

- `README.md`: the band section describes both views, how to switch (click the legend; ctrl+x tab or a click, then `v`; `/visual-recap view wall|work`, mid-turn too; the pick lasts until the session ends), and the work-mix image. The panel section describes the work mix and the Subagents row, with no percentage. The settings table gains **Band view** (`wall` default, `work`, any other value means `wall`). "How time is counted" describes subagent timing, wall-clock attribution (main loop first; Subagents only when no main turn is open) and work-mix totals (main-loop rows add up to its own time; Subagents adds every run in full, with the 5-minute example), and notes that a tool's time includes its permission prompt (T-04 not implemented).
- `CLAUDE.md` conventions: the two ways of counting, where each lives in `hooks/recap.ts` and which surface uses which, the "Agent calls" label, and the `view` atom reset at `session.end`.
- `docs/mockups.mjs`: draws the wall-clock band (`band.svg`, `band-done.svg`, the band in `panel.svg`) with the legend Button's `v:`, a new work-mix band (`band-work.svg`: a main-loop strip with a gap where only a background subagent ran, the subagent strip under it, and totals ending `Subagents 2m10s`), and the new panel (header with `subagents 3m05s`, "Agent calls" row, a Subagents row with no percentage). Strips can now hold `gap` blocks, and every word is still placed at its own column. Ran `node docs/mockups.mjs`.
- Browser check: copied the SVGs and a helper page to the scratchpad, served them with `python3 -m http.server 8766 --bind 127.0.0.1`, and screenshotted with headless Chrome (`--window-size=1100,1500`). Read the PNG. All five images render with words evenly spaced and nothing overlapping. The work-mix band's two rows line up, with the top row's gap over the lower row's fill. The first try overflowed the work-mix legend past the frame, so it now shows two main-loop totals before Subagents and fits.

## Reconciliation

<!-- One line per change spec, once applied to its maintained spec:

    - record-editing: applied to specs/record-editing/spec.md
-->

- time-accounting: applied to specs/time-accounting/spec.md
- band: applied to specs/band/spec.md
- panel: applied to specs/panel/spec.md
