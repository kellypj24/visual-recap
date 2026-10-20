# Appearance

## Purpose

How categories look wherever the band and the panel draw them: a color and a glyph per category. The palette setting (`palette` in `/config`) takes `default` or `theme`.

## Boundaries

This spec covers colors and glyphs on every surface. What the band and panel draw, and when, belongs to `band` and `panel`.

## Requirements

### Requirement: Default palette

Where the palette setting is `default`, unset or unrecognized, the system shall draw each category in its default color:

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

## Known discrepancies

None recorded.

## Open questions

None.
