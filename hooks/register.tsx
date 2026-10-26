import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Agent, BandView, Cat, Mark, Span, Turn } from '../types'
import { CATS, catOf, colorOf, fallbackSummary, fmt, labelOf, lanes, runs, strip, summaryPrompt, sweep, totals, workMix } from './recap'

const PANE = 'visual-recap'
const MAX_SPANS = 3000 // ponytail: oldest spans drop off; totals then undercount very long sessions
const MAX_ACTIONS = 60
const KEEP_SESSIONS = 10 // ponytail: $.store holds 4 MiB in all; older sessions' recaps are dropped

const spans = atom({ plugin: 'visual-recap', key: 'spans' } as const, [] as Span[])
const turns = atom({ plugin: 'visual-recap', key: 'turns' } as const, [] as Turn[])
const now = atom({ plugin: 'visual-recap', key: 'now' } as const, 0)
const startedAt = atom({ plugin: 'visual-recap', key: 'startedAt' } as const, 0)
// Animation step while a turn runs; only the band reads it, so the panel redraws once a second, not four times.
const marks = atom({ plugin: 'visual-recap', key: 'marks' } as const, [] as Mark[])
const frame = atom({ plugin: 'visual-recap', key: 'frame' } as const, 0)
// Each subagent's label and the main turn that spawned it, from agent.spawn; each of its runs looks it up at turn.start.
const agents = atom({ plugin: 'visual-recap', key: 'agents' } as const, {} as Record<string, Agent>)
// The band view picked with the legend, its letter or the command, until the session ends; null: the /config default.
const view = atom({ plugin: 'visual-recap', key: 'view' } as const, null as BandView | null)

const SPIN = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const PULSE = ['▂', '▄', '▆', '█', '▆', '▄']

type $ = EngineInterface

async function snapshot($: $) {
  const [sp, tu, n, st] = await Promise.all([read($, spans), read($, turns), read($, now), read($, startedAt)])
  const to = Math.max(n, st, ...tu.map(t => t.end ?? 0), ...sp.map(s => s.end ?? s.start))
  const from = st || Math.min(to, ...tu.map(t => t.start), ...sp.map(x => x.start))
  const pieces = sweep(sp, tu, from, to)
  const tot = totals(pieces)
  const live = tu.find(t => t.end === undefined)
  // The main loop first: a background subagent shows only while the main loop is idle.
  const open = sp.filter(s => s.end === undefined)
  const running = open.findLast(s => s.agentId === undefined) ?? (live ? undefined : open.at(-1))
  let liveText: string | undefined
  if (running) liveText = `${running.label} · ${fmt(to - running.start)}`
  else if (live) {
    const since = Math.max(live.start, ...sp.filter(s => s.agentId === undefined && s.start >= live.start).map(s => s.end ?? 0))
    liveText = `Thinking · ${fmt(to - since)}`
  }
  return { sp, tu, to, st: from, pieces, tot, live, running, liveText }
}

function sortedCats(tot: Partial<Record<Cat | 'idle', number>>) {
  return (Object.keys(CATS) as Cat[]).filter(c => (tot[c] ?? 0) >= 500).sort((a, b) => tot[b]! - tot[a]!)
}

// In the work mix the main loop's own Agent calls sit above a Subagents row of the subagents' work: name them apart.
const mixLabel = (c: Cat) => (c === 'agents' ? 'Agent calls' : CATS[c].label)

async function setView($: $, to: BandView | 'toggle', fallback: BandView) {
  await update($, view, v => (to === 'toggle' ? ((v ?? fallback) === 'work' ? 'wall' : 'work') : to))
}

let ticker: { cancel: () => void } | undefined
let ticks = 0

async function setNow($: $) {
  const t = await $.clock.now()
  await update($, now, () => t)
}

// With the band off nothing reads frame, so only the once-a-second clock runs.
function tick($: $, isAnimated: boolean) {
  ticks++
  if (isAnimated) void update($, frame, n => n + 1)
  if (!isAnimated || ticks % 4 === 0) void setNow($)
}

function startTicker($: $, isAnimated: boolean) {
  ticker ??= $.clock.every(isAnimated ? 250 : 1000, () => tick($, isAnimated))
}

function stopTicker() {
  ticker?.cancel()
  ticker = undefined
}

// Background subagents outlive the turn that spawned them, so a subagent's open run counts too.
async function isBusy($: $) {
  const [tu, sp] = await Promise.all([read($, turns), read($, spans)])
  return tu.some(t => t.end === undefined) || sp.some(s => s.end === undefined)
}

async function stopTickerIfIdle($: $) {
  if (!(await isBusy($))) stopTicker()
}

async function addMark($: $, kind: Mark['kind'], isAuto?: boolean) {
  const at = await $.clock.now()
  await update($, marks, l => [...l, { at, kind, ...(isAuto ? { isAuto } : {}) }].slice(-100))
}

async function summarize($: $, turnId: string, answer: string, useModel: boolean) {
  const turn = (await read($, turns)).find(t => t.id === turnId)
  if (!turn) return
  let text = ''
  if (useModel) {
    const r = await $.model.complete({
      model: 'haiku',
      prompt: summaryPrompt(turn, answer),
      maxTokens: 120,
      effort: 'low',
      timeoutMs: 30000,
    })
    text = r.isAnswered ? r.text.trim().split('\n')[0]! : ''
  }
  const summary = text || fallbackSummary(turn)
  await update($, turns, l => l.map(t => (t.id === turnId ? { ...t, summary } : t)))
}

type Saved = { spans: Span[]; turns: Turn[]; marks: Mark[]; startedAt: number; now: number }

// $.state lives as long as the process, so each session's recap is also kept in $.store for --resume.
async function save($: $, id: string) {
  const [sp, tu, mk, st, n] = await Promise.all([read($, spans), read($, turns), read($, marks), read($, startedAt), read($, now)])
  const saved: Saved = {
    // Labels and actions only matter while a span runs or a turn awaits its summary.
    spans: sp.map(s => (s.end === undefined ? s : { ...s, id: '', label: '' })),
    turns: tu.map(t => (t.summary === undefined ? t : { ...t, actions: [] })),
    marks: mk,
    startedAt: st,
    now: n,
  }
  const ids = ((await $.store.get('sessions')) as string[] | undefined) ?? []
  const keep = [...ids.filter(x => x !== id), id]
  for (const old of keep.slice(0, -KEEP_SESSIONS)) await $.store.delete(`s:${old}`)
  await $.store.set('sessions', keep.slice(-KEEP_SESSIONS))
  await $.store.set(`s:${id}`, saved)
}

async function restore($: $): Promise<boolean> {
  const saved = (await $.store.get(`s:${await $.session.id()}`)) as Saved | undefined
  if (!saved) return false
  // Whatever was still running when the process ended stops where the recap last saw it.
  const end = saved.now
  await update($, spans, () => saved.spans.map(s => (s.end === undefined ? { ...s, end } : s)))
  await update($, turns, () =>
    saved.turns.map(t => {
      const done = t.end === undefined ? { ...t, end, isAborted: true } : t
      return done.summary === undefined ? { ...done, summary: fallbackSummary(done) } : done
    }),
  )
  await update($, marks, () => saved.marks)
  await update($, startedAt, () => saved.startedAt)
  return true
}

function openPane($: $) {
  return $.ui.open({ id: PANE, title: 'Recap', columns: 56 })
}

export const register: Register = (on, options) => {
  const showBand = options.showBand !== false
  const summaries = options.summaries !== false
  const color = (c: Cat) => colorOf(c, options.palette)
  // An unrecognized value counts as unset, so the wall-clock view.
  const defaultView: BandView = options.bandView === 'work' ? 'work' : 'wall'

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'visual-recap',
      description: 'Open the visual recap: time by activity and a summary timeline',
      argumentHint: '[view wall|work]',
      immediate: true,
    })
    if ((await read($, startedAt)) === 0) {
      const t = await $.clock.now()
      if (!(await restore($).catch(() => false))) await update($, startedAt, () => t)
      await update($, now, () => t)
    }
    if (await isBusy($)) startTicker($, showBand)
    if (options.openPanel === true) void openPane($)

    return next(e)
  })

  on('command.run', { command: 'visual-recap' }, async ($, e) => {
    const [sub, arg] = e.args.trim().split(/\s+/)
    if (sub === 'view') {
      if (arg !== 'wall' && arg !== 'work') return { text: 'Band views: wall (wall-clock time) or work (work mix). Try /visual-recap view work.' }
      await setView($, arg, defaultView)
      return { text: `Band view: ${arg === 'wall' ? 'wall clock' : 'work mix'}.` }
    }
    await openPane($)

    return { text: 'Visual recap opened.' }
  })

  on('turn.start', async ($, e, next) => {
    const t = await $.clock.now()
    if (e.agentId === undefined) {
      const turn: Turn = { id: e.turnId, start: t, prompt: e.text.slice(0, 500), actions: [] }
      await update($, turns, l => [...l, turn].slice(-300))
    } else {
      // A background Agent call returns at once, so its span covers none of the subagent's work: time the subagent's own run.
      // Claude Code runs this and agent.spawn side by side, so the span goes in before the label is looked up:
      // a spawn that wrote the label before this read is found here, a later one patches the span itself.
      const agentId = e.agentId
      const span: Span = { id: `${agentId}:${t}`, cat: 'agents', label: 'Subagent', start: t, agentId }
      await update($, spans, l => [...l, span].slice(-MAX_SPANS))
      const a = (await read($, agents))[agentId]
      if (a) await update($, spans, l => l.map(s => (s.id === span.id ? { ...s, label: a.label, turnId: a.turnId } : s)))
    }
    await update($, now, () => t)
    startTicker($, showBand)

    return next(e)
  })

  // The Agent call's own description labels the subagent, matched by the id its events carry.
  // A nested subagent belongs to the main turn its parent belongs to.
  on('agent.spawn', async ($, e, next) => {
    const result = await next(e)
    const agentId = result.agentId
    if (agentId === undefined) return result
    const turnId =
      e.parentAgentId === undefined
        ? (await read($, turns)).findLast(t => t.end === undefined)?.id
        : (await read($, agents))[e.parentAgentId]?.turnId
    const label = labelOf({ tool: 'Agent', description: e.description })
    // ponytail: the last 200 subagents are remembered; an older one's later runs show as "Subagent"
    await update($, agents, m => {
      const rest = Object.entries(m).filter(([k]) => k !== agentId)
      return Object.fromEntries([...rest, [agentId, { label, turnId }] as const].slice(-200))
    })
    await update($, spans, l => l.map(s => (s.agentId === agentId && s.end === undefined ? { ...s, label, turnId } : s)))

    return result
  })

  // tool.call fires once the model has written the call's arguments, which can take far longer
  // than running it (a Write's contents, a long heredoc). Count that writing as the tool's time too.
  on('turn.step', async function* ($, e, next) {
    if (e.agentId !== undefined) return yield* next(e)
    let open: string | undefined
    const close = async () => {
      if (!open) return
      const id = open
      open = undefined
      const end = await $.clock.now()
      await update($, spans, l => l.map(s => (s.id === id ? { ...s, end } : s)))
    }
    try {
      for await (const c of next(e)) {
        if (open && c.kind !== 'input' && c.kind !== 'engine') await close()
        if (c.kind === 'tool') {
          open = `input:${c.id}`
          const span: Span = { id: open, cat: catOf(c.name), label: `Writing ${c.name}`, start: await $.clock.now() }
          await update($, spans, l => [...l, span].slice(-MAX_SPANS))
        }
        yield c
      }
    } finally {
      await close()
    }
  })

  on('tool.call', async ($, e, next) => {
    const label = labelOf(e as unknown as Record<string, unknown>)
    const action = e.agentId === undefined ? label : `↳ ${label}`
    // A subagent's calls belong to the turn that spawned it, which may have ended since.
    const turnId = e.agentId === undefined ? undefined : (await read($, agents))[e.agentId]?.turnId
    await update($, turns, l => {
      const i = turnId === undefined ? l.findLastIndex(t => t.end === undefined) : l.findLastIndex(t => t.id === turnId)
      if (i < 0 || l[i]!.actions.length >= MAX_ACTIONS) return l
      return l.with(i, { ...l[i]!, actions: [...l[i]!.actions, action] })
    })
    // Subagent calls happen inside the Agent call's span; timing them too would double count.
    if (e.agentId !== undefined) return next(e)

    const id = e.tool_use_id ?? crypto.randomUUID()
    const start = await $.clock.now()
    await update($, spans, l => [...l, { id, cat: catOf(e.tool), label, start }].slice(-MAX_SPANS))
    try {
      return await next(e)
    } finally {
      const end = await $.clock.now()
      await update($, spans, l => l.map(s => (s.id === id ? { ...s, end } : s)))
      await update($, now, () => end)
    }
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    const t = await $.clock.now()
    if (e.agentId === undefined) {
      await update($, turns, l => l.map(x => (x.id === e.turnId ? { ...x, end: t, isAborted: e.isAborted } : x)))
      await update($, spans, l => l.map(s => (s.end === undefined && s.agentId === undefined ? { ...s, end: t } : s)))
      const answer = e.answer
      $.clock.after(1, () =>
        void summarize($, e.turnId, answer, summaries)
          .catch(() => undefined)
          .then(async () => save($, await $.session.id()))
          .catch(() => undefined),
      )
    } else {
      const agentId = e.agentId
      await update($, spans, l => l.map(s => (s.end === undefined && s.agentId === agentId ? { ...s, end: t } : s)))
    }
    await update($, now, () => t)
    await stopTickerIfIdle($)

    return result
  })

  on('session.compact', async ($, e, next) => {
    const result = await next(e)
    // precompute only prepares a summary for later; a skip leaves the conversation as it was.
    if (e.agentId === undefined && e.trigger !== 'precompute' && result.skip === undefined) {
      await addMark($, 'compact', e.trigger === 'auto')
    }

    return result
  })

  // A /clear ends the conversation but not the process: the timeline carries on past a divider.
  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') await addMark($, 'clear')
    // A subagent the session takes down with it never reports its end.
    const t = await $.clock.now()
    await update($, spans, l => l.map(s => (s.end === undefined ? { ...s, end: t } : s)))
    stopTicker()
    await update($, view, () => null)
    await save($, e.sessionId).catch(() => undefined)
    // /resume swaps in another session: start over so session.start loads that one's recap.
    if (e.reason === 'resume') {
      await update($, spans, () => [])
      await update($, turns, () => [])
      await update($, marks, () => [])
      await update($, agents, () => ({}))
      await update($, startedAt, () => 0)
    }

    return next(e)
  })

  // Wide and short: a strip of agent-active time, then the live action and a legend.
  // Working: a pulsing leading edge and a spinner. Stopped: the same strip, dimmed.
  // mono: a proportional face would give each category's glyph its own width.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!showBand || e.props.hasSurvey) return next(e)
    const s = await snapshot($)
    const isWorking = s.live !== undefined || s.running !== undefined
    const f = isWorking ? await read($, frame) : 0
    const isWork = ((await read($, view)) ?? defaultView) === 'work'
    // The work mix: the main loop's strip, a strip of when subagents ran under it, on the wall-clock strip's axis.
    const lane = isWork ? lanes(s.sp, s.tu, s.st, s.to) : undefined
    const mix = isWork ? workMix(s.sp, s.tu, s.st, s.to) : undefined
    const width = Math.max(10, e.props.bodyColumns) - (isWorking ? 1 : 0)
    const cols = lane ? strip(lane.top, width, true) : strip(s.pieces, width, true)
    if (!cols.length) return next(e)
    const tot = mix?.main ?? s.tot
    const { Box, Button, Text } = $.ui.resolve(e)
    const nowCat: Cat = s.running?.cat ?? 'thinking'
    const last = s.tu.at(-1)

    return (
      <Box flexDirection="column">
        <Text wrap="truncate" mono>
          {runs(cols).map(r => r.cat === 'gap' ? <Text>{' '.repeat(r.n)}</Text> : (
            <Text color={color(r.cat)} dimColor={!isWorking}>{CATS[r.cat].glyph.repeat(r.n)}</Text>
          ))}
          {isWorking ? <Text color={color(nowCat)}>{PULSE[f % PULSE.length]}</Text> : null}
        </Text>
        {lane ? (
          <Text wrap="truncate" mono>
            {runs(strip(lane.low, width, true)).map(r => r.cat === 'gap' ? <Text>{' '.repeat(r.n)}</Text> : (
              <Text color={color('agents')} dimColor={!isWorking}>{CATS.agents.glyph.repeat(r.n)}</Text>
            ))}
          </Text>
        ) : null}
        {/* The legend line is the view switch: a click, or its letter while the band has focus. A Button wraps, so the Box cuts it to a line. */}
        <Box height={1} overflow="hidden">
        <Button key="view" hotkey="v" plain onPress={() => void setView($, 'toggle', defaultView)}>
        <Text wrap="truncate">
          {isWorking ? (
            <Text>
              <Text color={color(nowCat)}>{SPIN[f % SPIN.length]}</Text>
              <Text weight="bold"> {s.liveText}  </Text>
            </Text>
          ) : last?.end !== undefined ? (
            <Text dimColor>
              ✓ {last.isAborted ? 'Interrupted after' : 'Done in'} {fmt(last.end - last.start)} · waiting on you{'  '}
            </Text>
          ) : null}
          {sortedCats(tot).map(c => (
            <Text>
              <Text color={color(c)}>{CATS[c].glyph}</Text>
              <Text dimColor> {mix ? mixLabel(c) : CATS[c].label} {fmt(tot[c]!)}  </Text>
            </Text>
          ))}
          {mix && mix.subagents >= 500 ? (
            <Text>
              <Text color={color('agents')}>{CATS.agents.glyph}</Text>
              <Text dimColor> Subagents {fmt(mix.subagents)}  </Text>
            </Text>
          ) : null}
        </Text>
        </Button>
        </Box>
      </Box>
    )
  })

  // Tall and narrow: totals as bars, then the timeline, newest first.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const s = await snapshot($)
    const mk = await read($, marks)
    const width = Math.max(30, e.props.bodyColumns)
    // The work mix: main-loop rows that add up to the main loop's active time, then the subagents' work on top.
    const mix = workMix(s.sp, s.tu, s.st, s.to)
    const tot = mix.main
    const barW = Math.max(6, width - 25)
    const cats = sortedCats(tot)
    const active = Object.values(tot).reduce((n, ms) => n + ms, 0)
    const sum = active || 1
    const turnBar = (t: Turn) => {
      const lo = t.start
      const hi = t.end ?? s.to
      // A subagent's run belongs to the turn that spawned it, not to whichever turn it overlaps.
      const mine = s.sp.filter(x => x.start < hi && (x.end ?? s.to) > lo && (x.turnId === undefined || x.turnId === t.id))
      return runs(strip(sweep(mine, [t], lo, hi), Math.min(24, width - 16)))
    }

    return (
      <Box flexDirection="column">
        <Text>
          <Text weight="bold">Session {fmt(s.to - s.st)}</Text>
          <Text dimColor>  agent {fmt(active)}{mix.subagents >= 500 ? ` · subagents ${fmt(mix.subagents)}` : ''} · {s.tu.length} turns</Text>
        </Text>
        <Text wrap="truncate" dimColor={!s.liveText}>
          {s.liveText ? `▶ ${s.liveText}` : 'Idle, waiting on you'}
        </Text>
        <Text> </Text>
        {cats.length === 0 && mix.subagents < 500 && <Text dimColor>Nothing yet: time shows up as the agent works.</Text>}
        {cats.map(c => {
          const k = Math.round((tot[c]! / sum) * barW)
          return (
            <Text wrap="truncate">
              {mixLabel(c).padEnd(11)}
              <Text color={color(c)} mono>{CATS[c].glyph.repeat(k)}</Text>
              <Text dimColor mono>{'·'.repeat(barW - k)}</Text>
              {` ${fmt(tot[c]!).padStart(6)} ${String(Math.round((tot[c]! / sum) * 100)).padStart(3)}%`}
            </Text>
          )
        })}
        {/* Subagents' work adds on top of the main loop's, so it takes no share of it. */}
        {mix.subagents >= 500 && (
          <Text wrap="truncate">
            <Text color={color('agents')}>{CATS.agents.label.padEnd(11 + barW)}</Text> {fmt(mix.subagents).padStart(6)}
          </Text>
        )}
        {(s.tot.idle ?? 0) >= 1000 && <Text dimColor>{'Waiting on you'.padEnd(11 + barW)} {fmt(s.tot.idle!).padStart(6)}</Text>}
        <Text> </Text>
        <Text weight="bold">Timeline</Text>
        {s.tu.length === 0 && <Text dimColor>No turns yet.</Text>}
        {[...s.tu, ...mk]
          .sort((a, b) => ('at' in b ? b.at : b.start) - ('at' in a ? a.at : a.start))
          .map(t => 'at' in t ? (
          <Box marginBottom={1}>
            <Text dimColor wrap="truncate">
              {`── ${t.kind === 'clear' ? 'Cleared' : t.isAuto ? 'Auto-compacted' : 'Compacted'} · +${fmt(t.at - s.st)} `.padEnd(width, '─')}
            </Text>
          </Box>
        ) : (
          <Box flexDirection="column" marginBottom={1}>
            <Text wrap="truncate">
              <Text dimColor>+{fmt(t.start - s.st).padEnd(7)} {fmt((t.end ?? s.to) - t.start).padStart(6)}  </Text>
              {turnBar(t).map(r => (
                <Text color={color(r.cat)} mono>{CATS[r.cat].glyph.repeat(r.n)}</Text>
              ))}
              {t.isAborted ? <Text color="warning"> interrupted</Text> : null}
            </Text>
            {t.end === undefined ? (
              <Text dimColor>
                Working{t.prompt ? `: ${t.prompt.split('\n')[0]!.slice(0, 120)}` : '…'}
              </Text>
            ) : (
              <Text dimColor={t.summary === undefined}>{t.summary ?? 'Summarizing…'}</Text>
            )}
          </Box>
        ))}
      </Box>
    )
  })
}
