import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Cat, Mark, Span, Turn } from '../types'
import { CATS, catOf, fallbackSummary, fmt, labelOf, runs, strip, summaryPrompt, sweep, totals } from './recap'

const PANE = 'visual-recap'
const MAX_SPANS = 3000 // ponytail: oldest spans drop off; totals then undercount very long sessions
const MAX_ACTIONS = 60

const spans = atom({ plugin: 'visual-recap', key: 'spans' } as const, [] as Span[])
const turns = atom({ plugin: 'visual-recap', key: 'turns' } as const, [] as Turn[])
const now = atom({ plugin: 'visual-recap', key: 'now' } as const, 0)
const startedAt = atom({ plugin: 'visual-recap', key: 'startedAt' } as const, 0)
// Animation step while a turn runs; only the band reads it, so the panel redraws once a second, not four times.
const marks = atom({ plugin: 'visual-recap', key: 'marks' } as const, [] as Mark[])
const frame = atom({ plugin: 'visual-recap', key: 'frame' } as const, 0)

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
  const running = sp.filter(s => s.end === undefined).at(-1)
  let liveText: string | undefined
  if (running) liveText = `${running.label} · ${fmt(to - running.start)}`
  else if (live) {
    const since = Math.max(live.start, ...sp.filter(s => s.start >= live.start).map(s => s.end ?? 0))
    liveText = `Thinking · ${fmt(to - since)}`
  }
  return { sp, tu, to, st: from, pieces, tot, live, running, liveText }
}

function sortedCats(tot: Partial<Record<Cat | 'idle', number>>) {
  return (Object.keys(CATS) as Cat[]).filter(c => (tot[c] ?? 0) >= 500).sort((a, b) => tot[b]! - tot[a]!)
}

let ticker: { cancel: () => void } | undefined
let ticks = 0

async function setNow($: $) {
  const t = await $.clock.now()
  await update($, now, () => t)
}

function tick($: $) {
  ticks++
  void update($, frame, n => n + 1)
  if (ticks % 4 === 0) void setNow($)
}

function startTicker($: $) {
  ticker ??= $.clock.every(250, () => tick($))
}

function stopTicker() {
  ticker?.cancel()
  ticker = undefined
}

async function addMark($: $, kind: Mark['kind'], isAuto?: boolean) {
  const at = await $.clock.now()
  await update($, marks, l => [...l, { at, kind, ...(isAuto ? { isAuto } : {}) }].slice(-100))
}

async function summarize($: $, turnId: string, answer: string) {
  const turn = (await read($, turns)).find(t => t.id === turnId)
  if (!turn) return
  const r = await $.model.complete({
    model: 'haiku',
    prompt: summaryPrompt(turn, answer),
    maxTokens: 120,
    effort: 'low',
    timeoutMs: 30000,
  })
  const text = r.isAnswered ? r.text.trim().split('\n')[0]! : ''
  const summary = text || fallbackSummary(turn)
  await update($, turns, l => l.map(t => (t.id === turnId ? { ...t, summary } : t)))
}

function openPane($: $) {
  return $.ui.open({ id: PANE, title: 'Recap', columns: 56 })
}

export const register: Register = (on, options) => {
  const showBand = options.showBand !== false

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'visual-recap',
      description: 'Open the visual recap: time by activity and a summary timeline',
      immediate: true,
    })
    if ((await read($, startedAt)) === 0) {
      const t = await $.clock.now()
      await update($, startedAt, () => t)
      await update($, now, () => t)
    }
    if ((await read($, turns)).some(t => t.end === undefined)) startTicker($)
    if (options.openPanel === true) void openPane($)

    return next(e)
  })

  on('command.run', { command: 'visual-recap' }, async $ => {
    await openPane($)

    return { text: 'Visual recap opened.' }
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      const t = await $.clock.now()
      const turn: Turn = { id: e.turnId, start: t, prompt: e.text.slice(0, 500), actions: [] }
      await update($, turns, l => [...l, turn].slice(-300))
      await update($, now, () => t)
      startTicker($)
    }

    return next(e)
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
    await update($, turns, l => {
      const i = l.findLastIndex(t => t.end === undefined)
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
    if (e.agentId === undefined) {
      const t = await $.clock.now()
      await update($, turns, l => l.map(x => (x.id === e.turnId ? { ...x, end: t, isAborted: e.isAborted } : x)))
      await update($, spans, l => l.map(s => (s.end === undefined ? { ...s, end: t } : s)))
      await update($, now, () => t)
      stopTicker()
      const answer = e.answer
      $.clock.after(1, () => void summarize($, e.turnId, answer).catch(() => undefined))
    }

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

    return next(e)
  })

  // Wide and short: a strip of agent-active time, then the live action and a legend.
  // Working: tall strip, a pulsing leading edge and a spinner. Stopped: the strip drops to a thin line.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!showBand || e.props.hasSurvey) return next(e)
    const s = await snapshot($)
    const isWorking = s.live !== undefined
    const f = isWorking ? await read($, frame) : 0
    const cols = strip(s.pieces, Math.max(10, e.props.bodyColumns) - (isWorking ? 1 : 0))
    if (!cols.length) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const nowCat: Cat = s.running?.cat ?? 'thinking'
    const last = s.tu.at(-1)

    return (
      <Box flexDirection="column">
        <Text wrap="truncate">
          {runs(cols).map(r => (
            <Text color={CATS[r.cat].color}>{(isWorking ? '▆' : '▂').repeat(r.n)}</Text>
          ))}
          {isWorking ? <Text color={CATS[nowCat].color}>{PULSE[f % PULSE.length]}</Text> : null}
        </Text>
        <Text wrap="truncate">
          {isWorking ? (
            <Text>
              <Text color={CATS[nowCat].color}>{SPIN[f % SPIN.length]}</Text>
              <Text weight="bold"> {s.liveText}  </Text>
            </Text>
          ) : last?.end !== undefined ? (
            <Text dimColor>
              ✓ {last.isAborted ? 'Interrupted after' : 'Done in'} {fmt(last.end - last.start)} · waiting on you{'  '}
            </Text>
          ) : null}
          {sortedCats(s.tot).map(c => (
            <Text>
              <Text color={CATS[c].color}>■</Text>
              <Text dimColor> {CATS[c].label} {fmt(s.tot[c]!)}  </Text>
            </Text>
          ))}
        </Text>
      </Box>
    )
  })

  // Tall and narrow: totals as bars, then the timeline, newest first.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const s = await snapshot($)
    const mk = await read($, marks)
    const width = Math.max(30, e.props.bodyColumns)
    const active = s.to - s.st - (s.tot.idle ?? 0)
    const barW = Math.max(6, width - 25)
    const cats = sortedCats(s.tot)
    const sum = cats.reduce((n, c) => n + s.tot[c]!, 0) || 1
    const turnBar = (t: Turn) => {
      const lo = t.start
      const hi = t.end ?? s.to
      const mine = s.sp.filter(x => x.start < hi && (x.end ?? s.to) > lo)
      return runs(strip(sweep(mine, [t], lo, hi), Math.min(24, width - 16)))
    }

    return (
      <Box flexDirection="column">
        <Text>
          <Text weight="bold">Session {fmt(s.to - s.st)}</Text>
          <Text dimColor>  agent {fmt(active)} · {s.tu.length} turns</Text>
        </Text>
        <Text wrap="truncate" dimColor={!s.liveText}>
          {s.liveText ? `▶ ${s.liveText}` : 'Idle, waiting on you'}
        </Text>
        <Text> </Text>
        {cats.length === 0 && <Text dimColor>Nothing yet: time shows up as the agent works.</Text>}
        {cats.map(c => {
          const k = Math.round((s.tot[c]! / sum) * barW)
          return (
            <Text wrap="truncate">
              {CATS[c].label.padEnd(11)}
              <Text color={CATS[c].color}>{'█'.repeat(k)}</Text>
              <Text dimColor>{'░'.repeat(barW - k)}</Text>
              {` ${fmt(s.tot[c]!).padStart(6)} ${String(Math.round((s.tot[c]! / sum) * 100)).padStart(3)}%`}
            </Text>
          )
        })}
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
                <Text color={CATS[r.cat].color}>{'▆'.repeat(r.n)}</Text>
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
