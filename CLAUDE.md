# visual-recap

A Claude Code mod (a plugin of function hooks): a band above the prompt and a panel that show where the agent spends its time, plus a timeline of turns with one-line descriptions. Contributor workflow is in [CONTRIBUTING.md](CONTRIBUTING.md); what users see is in [README.md](README.md).

## Layout

- `hooks/register.tsx`: every hook and both drawings (band: `AbovePrompt`; panel: `Pane` with id `visual-recap`).
- `hooks/recap.ts`: pure logic with no `$`: tool categories, labels, the time sweep, strips, formatting, the summary prompt. Unit-test changes here in `tests/recap.test.ts`.
- `types/index.d.ts`: the state contract. Every `$.state` key the module uses is declared here under `visual-recap`.
- `tests/render.test.tsx`: drives events through the engine and mounts the band and panel on terminal and desktop.
- `docs/mockups.mjs`: draws the README's SVG images from sample data.

## API

- The API's declarations are laid in `.claude-plugin/types/claude-code/index.d.ts` once a `claude --plugin-dir .` session has loaded the mod. That file is the authority (about 20,000 lines): grep it for the event or element you need and read its doc comment. Don't guess shapes.
- The API is early access. When it changes, follow the declarations and `claude plugin validate .`.

## Rules the engine enforces

- A function that takes `$` must be declared at the top level of the module, or the validator refuses the module.
- `atom()` references take literal `plugin` and `key` strings (`{ plugin: 'visual-recap', key: 'spans' } as const`), never a variable.
- Values that drawings read live in `$.state` (atoms), not module variables: a reload starts the module over and keeps only state.
- A render hook never writes state. Write from event hooks, timers or handlers.
- In tests, register every hook beneath the plugin (`on(...)`) before the first `$` call.

## Conventions

- Tool time is measured on the main loop only (`e.agentId === undefined`). A subagent is timed as one `agents` span from its own `turn.start` to `turn.complete`, since a background Agent call returns at once. That span is background: `sweep` counts it only while the main loop is idle, and the band shows it only then. `agent.spawn` gives each subagent its label and the main turn it belongs to (a nested one inherits its parent's), kept in the `agents` atom. Its tool calls add to that turn's actions, not to the timing.
- Two ways of counting, both in `hooks/recap.ts`. Wall clock (`sweep`; the band's default view): each second once, to main-loop tools, else Thinking while a main turn is open, else Subagents while a subagent runs, else idle. Work mix (`workMix` and `lanes`; the panel, and the band's `work` view): main-loop rows from main-loop spans alone, adding up to the main loop's active time, plus every subagent run in full on top, overlapping runs each counted. There the main loop's own Agent calls are labeled "Agent calls".
- The band's view lives in the `view` atom (null means the `bandView` option) and is reset at `session.end`, so a pick lasts until the session ends.
- The band animates at 4 frames a second through the `frame` atom, which only the band reads, so the panel redraws once a second. Keep it that way.
- The panel and band must draw on every surface: use the element table from `$.ui.resolve(e)` and test on terminal and desktop.
- The Haiku summary call sends the turn's prompt, its action labels and the start of the reply. Sending anything more needs a README update.
- After changing how the band or panel looks, update `docs/mockups.mjs`, run it, and check the SVGs in a browser. Each word is placed at its own column because browsers collapse spaces in SVG text.

## Before you finish

```
claude plugin validate .
claude plugin test .
npx -p typescript tsc -p .
```

PR titles are Conventional Commits (`feat:`, `fix:`, ...); `main` takes squash-merged PRs only.
