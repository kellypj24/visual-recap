# Changes to appearance

The changes that change 261020-v96wp proposes to the requirements of `appearance`: how categories look wherever the band and the panel draw them. This is future work. There is no maintained spec for `appearance` at 46b9563, so every requirement is ADDED, and today's behavior is described under "Observed current behavior".

## ADDED Requirements

### Requirement: Default palette

Where the palette setting is `default`, unset or unrecognized, the system shall draw each category in its default color, as listed in this change's proposal under "The default palette is Option 1".

#### Scenario: Thinking beside Asking you

- GIVEN the palette setting unset
- WHEN the band draws a Thinking block next to an Asking you block
- THEN Thinking is drawn in `#C8601A` and Asking you in `#2FA88A`

### Requirement: Theme preset

Where the palette setting is `theme`, the system shall draw each category in a Claude Code theme color, so the colors change with the person's theme.

#### Scenario: Switching to a light theme

- GIVEN the palette setting `theme`
- WHEN the person switches Claude Code from a dark theme to a light theme
- THEN the band and the panel redraw in that theme's colors for each category

### Requirement: A glyph per category

The system shall draw each category with a glyph of its own, the same on every surface, in the band's strip, the legend, the panel's totals bars and the per-turn bars.

#### Scenario: Colors that look alike

- GIVEN a strip in which a Web block sits next to an Asking you block
- WHEN it is viewed with red-green color blindness
- THEN the two blocks are told apart by their glyphs

#### Scenario: Both surfaces

- GIVEN a session with time in every category
- WHEN the band and the panel draw on the terminal and on the desktop
- THEN each category's glyph is the same on both surfaces

## Observed current behavior

Evidence, not agreement. At `043bdec` (`hooks/recap.ts` matches `46b9563`):

- `CATS` gives each category one fixed hex color (`hooks/recap.ts:3-12`).
- Every category is drawn with the same glyph: `▆` or `▂` in the band's strip (`hooks/register.tsx:281` at `043bdec`), `■` in the legend, `█` and `░` in the panel's totals bars (`hooks/register.tsx:340`), `▆` in per-turn bars.
- The `/config` settings are `showBand` and `openPanel` (`.claude-plugin/plugin.json`).
- Colors may be a theme key that follows the person's theme, or a raw color (`Color` and `ThemeKey` in `.claude-plugin/types/claude-code/index.d.ts:1710-1717` and `13229`).
