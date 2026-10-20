# Band colors and glyphs

## Problem

The owner: "Right now the low contrast difference between Thinking, Shell and Asking you makes it hard to differentiate sometimes," and "I also think we need to support different color themes or ways of customizng by the user."

What the code does at `043bdec` (`hooks/recap.ts` matches `46b9563`):

- The eight categories have fixed hex colors (`hooks/recap.ts:3-12`), the same on every theme and terminal.
- Measured with the data-viz skill's palette checker (color difference in OKLab ×100; 15 is the floor for normal vision, 8 the target under color blindness): Thinking `#D97757` and Asking you `#E06C75` differ by 5.4 with normal vision and about 4 under red-green color blindness. Reading and Shell differ by 3 under red-green color blindness.
- Color is the only thing that tells categories apart. Every category is drawn with the same glyph: `▆` in the band while working, `▂` once done (`hooks/register.tsx:281` at `043bdec`), `█` in the panel, `■` in the legend.

## Intended outcome

- A default palette in which Thinking, Shell and Asking you are clearly apart, with normal vision and with red-green color blindness.
- A `/config` setting that switches to a `theme` preset, which follows the person's Claude Code theme, including its light and colorblind themes.
- Each category drawn with its own glyph in the band, legend and panel, so color is never the only cue.
- The band keeps the same height when a turn ends. It shows it's done by dimming the strip, next to the `✓ Done` text.

## Scope

### In scope

- The new default palette and the `theme` preset, and their `/config` setting.
- Per-category glyphs wherever a category is drawn.
- The band's done state.
- README and `docs/mockups.mjs` updates.

### Out of scope

- Colorblind (Okabe-Ito) or mono presets. The owner chose "lets just improve default and support theme".
- Per-category color overrides in `/config`. The owner picked presets ("a") and glyphs ("d"), not overrides ("b").
- The strip's scale (change `261020-5e6me`) and what the band counts (change `261020-0z6h5`).

## Decisions

- **Presets plus glyphs.** Offered presets, per-category overrides, both, or a better default with glyphs, the owner chose "a & d".
- **Two presets: an improved default and theme.** The owner: "lets just improve default and support theme."
- **The default palette is Option 1.** Shown a preview page with both candidates, the owner chose "option 1":

  | Category | Color |
  |---|---|
  | Thinking | `#C8601A` |
  | Reading | `#37A8EC` |
  | Editing | `#68BE1F` |
  | Shell | `#9F43C3` |
  | Web | `#D3316A` |
  | Subagents | `#5978FD` |
  | Asking you | `#2FA88A` |
  | Other tools | `#8A8F98` |

  Checker scores (normal / red-green color blindness): Thinking–Asking you 24 / 12, Thinking–Shell 26 / 26, Shell–Asking you 32 / 18. The weakest pair is Web–Asking you at 32 / 7, which the glyphs also tell apart.
- **The band keeps its height when done.** Offered glyphs only in the legend and panel, patterns that are lost in the thin done line, or dropping the height change, the owner chose "c": the done state is a dimmed strip plus the `✓ Done` text.
- **This lands after `261020-5e6me`.** The owner chose to land the strip change first.

## Open questions

Can wait until review:

- The glyph set. The preview page drew a first draft, and the owner commented only on colors.
- Whether the quadrant glyphs (`▚` `▞`) draw at full width on the desktop surface and in common terminal fonts. T-02 checks this before settling the set.

## Assumptions to confirm in review

- The draft glyphs: `█` Thinking, `▓` Reading, `▒` Editing, `▚` Shell, `▌` Web, `▐` Subagents, `▞` Asking you, `░` Other tools. The legend draws each category's glyph in its color, in place of `■`.
- The `theme` preset maps categories to theme keys: Thinking `claude`, Reading `suggestion`, Editing `diffAdded`, Shell `bashBorder`, Web `ide`, Subagents `planMode`, Asking you `permission`, Other tools `inactive`. Whether these keys are distinct enough in Claude Code's themes hasn't been checked.
- The setting is named `palette`, with values `default` and `theme`. An unrecognized value falls back to `default`.
- The default palette is one set of colors for both light and dark terminals. On a white background, Reading, Editing and Asking you are below 3:1 contrast. The legend's labels and the glyphs make up for it, and light-theme users can choose `theme`.

## Related documents

- Requirements:
  - [specs/appearance/spec.md](specs/appearance/spec.md)
  - [specs/band/spec.md](specs/band/spec.md)
- Tasks: [tasks.md](tasks.md)
- Preview of the candidate palettes: https://claude.ai/artifact/AyichHM8ttgZPU9awCvdQQ (private to the owner)
