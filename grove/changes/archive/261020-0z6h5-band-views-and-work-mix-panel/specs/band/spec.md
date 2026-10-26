# Changes to band

The changes that change 261020-0z6h5 proposes to the requirements of `band`, the strip and totals drawn above the prompt. This is future work. There is no maintained spec for `band` at 46b9563, so every requirement is ADDED, and today's behavior is described under "Observed current behavior". Change `261020-5e6me` also adds requirements to `band`; this change builds on them.

## ADDED Requirements

### Requirement: Wall-clock view by default

Where the band view setting is unset or holds an unrecognized value, the system shall draw the band in the wall-clock view, its strip and totals following the wall-clock attribution in `time-accounting`.

#### Scenario: A fresh install

- GIVEN the plugin installed with no band view setting
- WHEN the band draws
- THEN it shows one strip of wall-clock time and the wall-clock totals

### Requirement: Work-mix view

While the band is in the work-mix view, the system shall draw two strips on the same time scale, the main loop's on top and one marking when any subagent ran beneath it, followed by the work-mix totals.

#### Scenario: A subagent beside the main loop

- GIVEN a session in which a subagent ran during the second half of a turn
- WHEN the band draws in the work-mix view
- THEN the lower strip is filled under the second half of that turn and empty elsewhere, and the totals include a Subagents total that adds to the main-loop totals

### Requirement: Switch views from the band

When the person clicks the band's legend, or presses the view letter while the band has focus, the system shall switch the band to the other view.

#### Scenario: Clicking the legend

- GIVEN the band in the wall-clock view
- WHEN the person clicks the legend line
- THEN the band redraws in the work-mix view, and clicking again returns it to the wall-clock view

### Requirement: Switch views by command

When the person runs `/visual-recap view wall` or `/visual-recap view work`, the system shall draw the band in the view named, and shall leave the band as it is and say which views exist when the argument names neither.

#### Scenario: Switching mid-turn

- GIVEN a turn running with the band in the wall-clock view
- WHEN the person runs `/visual-recap view work`
- THEN the band redraws in the work-mix view without waiting for the turn to end

### Requirement: Default view in /config

The system shall offer a band view setting in `/config` whose value, `wall` or `work`, chooses the view the band starts a session in.

#### Scenario: Work mix as the default

- GIVEN the band view setting set to `work`
- WHEN a new session starts
- THEN the band draws in the work-mix view

## Observed current behavior

Evidence, not agreement. At `043bdec` (`origin/main`):

- The band draws one strip and one line holding the live action and the totals, from the same totals as the panel (`hooks/register.tsx`, the `AbovePrompt` hook, lines 265-304).
- The plugin's `/config` settings are `showBand` and `openPanel` (`.claude-plugin/plugin.json`).
- `/visual-recap` takes no argument and opens the panel (`hooks/register.tsx`, the `command.run` hook).
- Claude Code collapses the band with ctrl+x ctrl+a or its `[-]` mark, and focuses it with ctrl+x tab or a click (`.claude-plugin/types/claude-code/index.d.ts:10670`).
