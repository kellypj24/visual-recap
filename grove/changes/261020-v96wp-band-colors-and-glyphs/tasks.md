## T-01 — Default palette and theme preset

Result: categories are drawn as "Default palette" and "Theme preset" in [specs/appearance/spec.md](specs/appearance/spec.md) require, with the palette setting declared in `.claude-plugin/plugin.json`.

Acceptance:
- A unit test checks that every category has a default color and a theme key.
- Render tests on terminal and desktop find the default colors when the setting is unset or unrecognized, and theme keys when it is `theme`.
- The theme mapping has been looked at in at least one dark and one light Claude Code theme, and any pair that looks alike is noted in this change's `implementation.md`.

## T-02 — Per-category glyphs and the done state

Result: the band, legend and panel follow "A glyph per category" in [specs/appearance/spec.md](specs/appearance/spec.md), and the band follows [specs/band/spec.md](specs/band/spec.md).

Acceptance:
- Before the glyph set is settled, it has been checked that each glyph draws at full width on the desktop surface and in at least two common terminal fonts; any glyph swapped out is noted in `implementation.md`.
- Render tests on terminal and desktop find each category's glyph in the strip, legend and panel, and the done strip keeping its glyphs, dimmed.
- `claude plugin validate .`, `claude plugin test .` and `npx -p typescript tsc -p .` pass.

## T-03 — README and images

Result: the README describes the palette setting, the glyphs and the dimmed done state, and its images are redrawn in the new colors and glyphs.

Acceptance:
- `README.md` no longer says the strip drops to a thin line when the agent stops, and its settings table lists the palette setting.
- `docs/mockups.mjs` uses the new palette and glyphs, it has been run, and the regenerated SVGs have been checked in a browser.
