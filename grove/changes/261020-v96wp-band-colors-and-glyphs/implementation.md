# Implementation: Band colors and glyphs

<!-- Progress on change 261020-v96wp, written by whoever implements it. It is not
part of what was approved and does not amend it. If the owner drops the change,
write "Status: dropped" here with their reason. -->

## How this was applied

`grove instructions apply 261020-v96wp` refuses on this branch: "261020-v96wp waits on 261020-5e6me, which main has not archived as finished". The change is built on `feat/steadier-band-strip` (PR #15, 261020-5e6me done), as the owner directed. This file follows the template that `grove instructions apply 261020-5e6me` prints, which is the same for every change.

## Assumptions used

- Draft glyphs, held as written: `█` Thinking, `▓` Reading, `▒` Editing, `▚` Shell, `▌` Web, `▐` Subagents, `▞` Asking you, `░` Other tools. The legend draws each category's glyph in its color in place of `■`. No glyph was swapped (see T-02).
- Theme preset map, held as written: Thinking `claude`, Reading `suggestion`, Editing `diffAdded`, Shell `bashBorder`, Web `ide`, Subagents `planMode`, Asking you `permission`, Other tools `inactive`. All eight are in `ThemeKey` (`.claude-plugin/types/claude-code/index.d.ts:13229`). It is not distinct in every theme, though: `suggestion` and `permission` are the same color in every built-in theme (see T-01). This is a finding for review; the map is unchanged.
- The setting is `palette`, with values `default` and `theme`. A value that is neither falls back to `default`. It is declared as a string field with `options` and default `default`. Per the declarations (`PluginOptions`), `/config` draws it as a picker and treats a stored value outside the options as unset. `colorOf()` also falls back on its own.
- One default palette for light and dark, held as written.

Found while building. None of these changes direction:

- **Dimmed on the terminal means gray.** Per the declarations, `dimColor` is "drawn in the theme's dim color" on the terminal. I checked this in a real session (a throwaway mod under `claude --plugin-dir`, captured with `tmux capture-pane -e`). A Text with `color="#C8601A" dimColor` is drawn in 256-color 246, the theme's dim gray, the same as plain dim text. A `dimColor` parent does not dim a colored child at all. So the done strip keeps its glyphs and columns but loses its category colors on the terminal until the next turn. The glyphs keep the categories apart. If the owner wants color kept when done, that needs pre-dimmed colors (the default palette only; theme keys cannot be blended), which would be a revision.
- **The panel's empty track changed from `░` to `·`.** `░` is now the Other tools glyph. On the Other tools row, its gray `░` bar would have run into the dim `░` track with nothing to tell them apart.
- **`mono` on the strip and bars.** On desktop, `Text` uses the surface's proportional face unless it has `mono` (`TextProps.mono`). In proportional faces, each block glyph has its own width (see T-02), so the band strip, the panel's totals bars and the per-turn bars set `mono`. The terminal ignores it.

## Tasks

### T-01 — Default palette and theme preset

Status: done

What changed:
- `hooks/recap.ts`: each `CATS` entry has its Option 1 `color`, its `theme` key (typed `ThemeKey`) and its `glyph`. New `colorOf(cat, palette)` returns the theme key when `palette === 'theme'` and the default color otherwise.
- `hooks/register.tsx`: `const color = (c: Cat) => colorOf(c, options.palette)` inside `register`. Every `CATS[...].color` in the band (strip, pulse, spinner, legend) and in the panel (totals bars, per-turn bars) now calls `color(...)`.
- `.claude-plugin/plugin.json`: `userConfig.palette` (string, options `default`/`theme`, default `default`). In a real session, `/config` shows "Palette · visual-recap  default ›".

Evidence:
- Acceptance "a unit test checks that every category has a default color and a theme key": `tests/recap.test.ts` "every category has a default color, a theme key and a glyph of its own". It also checks that the eight colors and the eight glyphs are distinct, and that Thinking is `#C8601A` and Asking you `#2FA88A` (scenario "Thinking beside Asking you"). "the palette setting picks default colors or theme keys, anything unknown falling back to default" covers `colorOf`.
- Acceptance "render tests on terminal and desktop find the default colors when the setting is unset or unrecognized, and theme keys when it is `theme`": `tests/render.test.tsx` covers three cases: "with the palette unset, …", "an unrecognized palette falls back to the default colors" (`palette: 'neon'`) and "the theme palette draws each category in its theme key" (`palette: 'theme'`). Each drives a turn with time in all eight categories. On both surfaces, it finds each category's strip block and legend mark in the band, and its totals bar and per-turn bar in the panel, in the expected color.
- Scenario "Switching to a light theme": the band and panel pass theme keys as `color`, which, per `Color`'s doc, "follows the person's theme". The test kit does not paint, so the redraw on a theme switch belongs to the surface. A real-session check of a theme key: `color="claude"` drew as 256-color 174, the current theme's `claude` color, where `#C8601A` drew as 173.
- Acceptance "the theme mapping has been looked at in at least one dark and one light Claude Code theme": the theme tables were read from the installed `claude` 2.1.305 binary (`dark`, `light`, `dark-daltonized`, `light-daltonized`, `dark-ansi`, `light-ansi`). Pairs were compared with the data-viz skill's checker (`validate_palette.py`: OKLab ΔE×100, Machado red-green simulation; floors 15 normal and 6 red-green). Mapped colors:

  | Category (key) | dark | light | dark-daltonized | light-daltonized |
  |---|---|---|---|---|
  | Thinking (`claude`) | 215,119,87 | 215,119,87 | 255,153,51 | 255,153,51 |
  | Reading (`suggestion`) | 177,185,249 | 87,105,247 | 153,204,255 | 51,102,255 |
  | Editing (`diffAdded`) | 34,92,43 | 105,219,124 | 0,68,102 | 153,204,255 |
  | Shell (`bashBorder`) | 253,93,177 | 255,0,135 | 51,153,255 | 0,102,204 |
  | Web (`ide`) | 71,130,200 | 71,130,200 | 71,130,200 | 71,130,200 |
  | Subagents (`planMode`) | 72,150,140 | 0,102,102 | 102,153,153 | 51,102,102 |
  | Asking you (`permission`) | 177,185,249 | 87,105,247 | 153,204,255 | 51,102,255 |
  | Other tools (`inactive`) | 153,153,153 | 102,102,102 | 153,153,153 | 102,102,102 |

  Pairs that look alike (normal / red-green ΔE):
  - **Reading and Asking you are identical in every theme** (0 / 0): `suggestion` and `permission` hold the same color. The ANSI themes too (`ansi:blueBright` in dark-ansi, `ansi:blue` in light-ansi). Only the glyphs (`▓` and `▞`) tell them apart.
  - Subagents and Other tools: dark 10.0 / 3.4, light 9.2 / 2.2, both daltonized themes 6.5 / 1.7.
  - dark: Web and Subagents 12.3 / 11.8, and Thinking and Other tools 12.9 / 9.0.
  - light: Reading and Web 10.2 / 9.0, and Web and Asking you 10.2 / 9.0.
  - dark-daltonized: Shell and Web 9.3 / 8.9, and Web and Subagents 11.6 / 11.2.
  - light-daltonized: Reading and Shell, and Shell and Asking you, both 8.3 / 7.5. Shell and Web 9.4 / 9.1, and Reading and Web 11.8 / 10.5.
  - Also: in dark, `diffAdded` is a dark green made for a diff background, 2.6:1 against black. In light-daltonized, Editing (`diffAdded`, 153,204,255) is 1.7:1 against white, and Thinking 2.1:1.
- Checks: see T-02.

### T-02 — Per-category glyphs and the done state

Status: done

What changed:
- `hooks/register.tsx`, band: each strip run draws `CATS[cat].glyph` instead of `▆`/`▂`. It is drawn with `dimColor={!isWorking}`, so it keeps its glyphs and columns, dimmed, when the turn has ended. The strip line has `mono`. The pulsing leading edge (`▂▄▆█▆▄` in the live category's color) and the spinner draw only while working, as before. The done line is unchanged: `✓ Done in <duration>`, or `✓ Interrupted after <duration>`, then `· waiting on you`. The legend draws each category's glyph in its color in place of `■`.
- `hooks/register.tsx`, panel: totals bars draw the category's glyph instead of `█`, with a dim `·` track instead of `░`. Per-turn bars draw the glyph instead of `▆`. Both have `mono`.

Glyph width check (acceptance: before the set is settled):
- Font coverage (`fc-list :charset=`): Menlo, SF Mono (`.SF NS Mono`) and MesloLGS NF have all eight glyphs. Courier New, Andale Mono and PT Mono lack the quadrants `▚` and `▞`, and Monaco lacks most of them. That includes `▆` and `▂`, which the band already used.
- Advance widths, measured in headless Chrome with DOM spans at 100 px, each glyph against `M`:
  - Menlo (60.2), MesloLGS NF (60.2), SF Mono (61.8, loaded from `/System/Library/Fonts/SFNSMono.ttf`) and generic `monospace` (Menlo, 60.2): all eight are exactly one cell.
  - Courier New, Andale Mono and PT Mono (60.0): every glyph is one cell. The quadrants come from a fallback font at 60.2, a third of a percent wider, which is not visible.
  - Monaco: `▒` is 50.0 against a 60.0 cell, five sixths wide. A terminal still gives it one cell, but it may draw narrower there. The other glyphs are one cell.
  - The screenshots show every glyph filling its cell in the monospaced faces, and the half blocks and quadrants drawing as intended.
- Desktop surface: I couldn't establish which face it draws a plugin's `Text` in. The desktop app's bundle uses `var(--font-sans)`/anthropic-sans and `ui-monospace, SFMono-Regular, Menlo, …` for mono. In proportional faces, the glyphs are not one width: in system-ui (SF Pro), `█` is 100, `▓` 94.2, `▒` 86.5, `▚` 60.2, `▐` 60.2 and `▞` 60.2. So the strip and bars set `mono` (the surface's monospaced face, very likely SF Mono or Menlo, where all eight are one cell).
- Settled: the draft set, with no glyph swapped. Note for review: `▒` in Monaco is narrower than its cell, and `▚`/`▞` rely on font fallback in Courier New, Andale Mono and PT Mono. Terminals that draw block elements themselves (kitty, WezTerm, Ghostty, iTerm2 with its built-in glyphs) are not affected.

Evidence (tests):
- Acceptance "render tests on terminal and desktop find each category's glyph in the strip, legend and panel": the three palette tests in T-01 find, on both surfaces, a run of each category's glyph in the strip, a single glyph in the legend, and at least two `mono` glyph runs in the panel (its totals bar and its piece of the turn's bar). The strip line has `mono` set. This covers scenario "Both surfaces". Scenario "Colors that look alike" (Web next to Asking you) holds because the glyphs are distinct, `▌` and `▞`, which the unit test checks.
- Acceptance "the done strip keeping its glyphs, dimmed": "a finished turn keeps the strip and its glyphs, dimmed; the next turn brings it back". On both surfaces, the strip text after `turn.complete` equals the working strip with its pulse cell left off: same glyphs, same columns. Every run has `dimColor: true`, and `✓ Done in 28s · waiting on you` is shown (scenario "A turn ends"). After the next `turn.start`, no run is dimmed, the last cell is a pulse frame, the spinner is drawn and "Done in" is gone (scenario "Working again").
- The existing tests still pass. "a second later the band keeps the blocks it drew" now finds the strip by any category glyph instead of `^▆`. "Done in 9s · waiting on you" still passes.
- Checks: `claude plugin validate .` passes (the only warning, ICON_MISSING, is also on the base branch). `claude plugin test .` passes 18 of 18. `npx -p typescript tsc -p .` reports no errors.

### T-03 — README and images

Status: done

What changed:
- `README.md`: the band paragraph lists the glyph for each activity and says that the legend and the panel's bars use them. The thin-line sentence is replaced: the strip stays as it was, dimmed, and in the terminal, dimmed means the theme's dim color, so the glyphs carry the activities. The done image's alt text is updated. The settings table has a Palette row: `default` or `theme`, plus a note that built-in themes give Reading and Asking you the same color.
- `docs/mockups.mjs`: `C` holds the Option 1 colors and the glyphs. `strip()` draws each block in its category's glyph, and the done band's strip in the dim color. A `cell()` helper draws `█▌▐▚▞` as rects and `▓▒░` as 75%, 50% and 25% dot patterns. The legend uses glyphs. The panel bars use glyphs with a dim `·` track. Text is still placed word by word, each at its own column.

Evidence:
- Acceptance "`README.md` no longer says the strip drops to a thin line … settings table lists the palette setting": done, as above.
- Acceptance "mockups.mjs uses the new palette and glyphs, it has been run, and the regenerated SVGs have been checked in a browser": ran `node docs/mockups.mjs`, which regenerated `docs/band.svg`, `docs/band-done.svg`, `docs/panel.svg` and `docs/strip.svg`. I screenshotted each in headless Google Chrome and looked at the PNGs:
  - The working band shows the colored glyph strip with its pulse cell, and the legend glyphs.
  - The done band shows the same strip in gray glyphs and the `✓ Done in 2m40s · waiting on you` line.
  - The panel shows glyph bars with dotted tracks and glyph per-turn bars.
  - In `strip.svg`, only the colors are new.
  - No text is clipped or overlapping. `strip.svg` is the idle-gap diagram and stays as plain color bars.

## Reconciliation

<!-- One line per change spec, once applied to its maintained spec:

    - record-editing: applied to specs/record-editing/spec.md
-->
