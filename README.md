# visual-recap

A Claude Code mod that shows where the agent spends its time, live, and keeps a running timeline of what happened in the session.

- **Band above the prompt:** a colored strip of the agent's working time (thinking, reading, editing, shell, web, subagents, asking you, other tools), what it's doing right now, and running totals.
- **Panel (`/visual-recap`):** time per activity as bars, time spent waiting on you, and a timeline of turns, newest first, each with a one-sentence description.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install visual-recap --marketplace mascah/visual-recap
```

Answer `y` to add the marketplace, then pick a scope (user scope is first; press Enter).

From a shell:

```
claude plugin install visual-recap --marketplace mascah/visual-recap
```

In the desktop app: click + next to the prompt box, then Plugins, Add marketplace with `mascah/visual-recap`, then Add plugin.

## Settings

In `/config`, under visual-recap:

| Setting | Default | What it does |
| --- | --- | --- |
| Show band | on | Shows the strip and totals above the prompt. |
| Open panel at startup | off | Opens the panel when a session starts. |

## How time is counted

- Time inside a tool call goes to that tool's activity. Parallel calls split their shared time.
- Time inside a turn with no tool running counts as Thinking.
- Time between turns counts as Waiting on you. The band's strip leaves it out.
- Subagents' work counts once, as Subagents.

## Turn descriptions use an extra model call

When a turn ends, the mod asks Haiku for a one-sentence description. It sends your prompt, the actions taken (file names, commands) and the start of the agent's reply. This uses your account and costs one small call per turn. If the call fails, the entry lists the turn's first actions instead.

## Development

```
claude plugin validate .
claude plugin test .
claude --plugin-dir .
```

## License

MIT
