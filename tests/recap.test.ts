import { expect, test } from 'claude-code/testing'

import type { Cat, Span, Turn } from '../types'
import { CATS, catOf, colorOf, labelOf, lanes, runs, scaleFor, strip, sweep, totals, workMix } from '../hooks/recap'
import type { Piece } from '../hooks/recap'

const turn: Turn = { id: 't', start: 0, end: 100, prompt: 'x', actions: [] }
const spans: Span[] = [
  { id: 'a', cat: 'reading', label: 'Read', start: 10, end: 30 },
  { id: 'b', cat: 'shell', label: 'Bash', start: 20, end: 40 }, // overlaps a by 10
]

test('time splits into thinking, tools and idle without double counting', async () => {
  const tot = totals(sweep(spans, [turn], 0, 150))
  expect(tot.reading).toBe(15) // 10 alone + half of the 10 shared
  expect(tot.shell).toBe(15)
  expect(tot.thinking).toBe(70)
  expect(tot.idle).toBe(50)
})

test("a subagent's run fills only time the main loop leaves idle", async () => {
  // t1 launches a background agent at 1s and ends at 2s; t2 thinks 4s, then runs a 6s Bash.
  const turns: Turn[] = [
    { id: 't1', start: 0, end: 2, prompt: 'x', actions: [] },
    { id: 't2', start: 5, end: 15, prompt: 'y', actions: [] },
  ]
  const sp: Span[] = [
    { id: 'a', cat: 'agents', label: 'Agent', start: 1, end: 20, agentId: 'a1', turnId: 't1' },
    { id: 'b', cat: 'shell', label: 'Bash', start: 9, end: 15 },
  ]
  const tot = totals(sweep(sp, turns, 0, 25))
  expect(tot.shell).toBe(6)
  expect(tot.thinking).toBe(6) // t1's 2s + t2's 4s
  expect(tot.agents).toBe(8) // 2-5 and 15-20, while the main loop was idle
  expect(tot.idle).toBe(5)
})

// time-accounting, "Wall-clock attribution puts the main loop first", both scenarios.
const bg: Span = { id: 'a', cat: 'agents', label: 'Agent', start: 0, agentId: 'a1', turnId: 't1' }

test('wall clock: a background subagent gets nothing while the main loop thinks or runs tools', async () => {
  // Turn 1 launched the subagent and ended at 1s; turn 2 thinks 4s, then runs Bash 6s.
  const turns: Turn[] = [
    { id: 't1', start: 0, end: 1, prompt: 'x', actions: [] },
    { id: 't2', start: 1, end: 11, prompt: 'y', actions: [] },
  ]
  const sp: Span[] = [bg, { id: 'b', cat: 'shell', label: 'Bash', start: 5, end: 11 }]
  const tot = totals(sweep(sp, turns, 1, 11))
  expect(tot).toEqual({ thinking: 4, shell: 6 })
})

test('wall clock: a background subagent while you are away counts as Subagents, not waiting', async () => {
  const turns: Turn[] = [{ id: 't1', start: 0, end: 1, prompt: 'x', actions: [] }]
  expect(totals(sweep([bg], turns, 1, 31))).toEqual({ agents: 30 })
})

// time-accounting, "Work-mix totals count subagent work on top": Two subagents beside the main loop.
test('work mix: main-loop rows add up to its own time and overlapping subagents each count in full', async () => {
  const m = 60_000
  const turns: Turn[] = [{ id: 't1', start: 0, end: 5 * m, prompt: 'x', actions: [] }]
  const sp: Span[] = [
    { id: 'b', cat: 'shell', label: 'Bash', start: 0, end: 5 * m },
    { ...bg, start: 0, end: 5 * m },
    { ...bg, id: 'c', agentId: 'a2', start: 0, end: 5 * m },
  ]
  expect(workMix(sp, turns, 0, 5 * m)).toEqual({ main: { shell: 5 * m }, subagents: 10 * m })
  // Subagent time with no main turn open is not the main loop's.
  const after = workMix([{ ...bg, start: 0, end: 7 * m }], turns, 0, 7 * m)
  expect(after).toEqual({ main: { thinking: 5 * m }, subagents: 7 * m })
})

// band, "Work-mix view": A subagent beside the main loop.
test('work-mix lanes: the lower row fills only where a subagent ran, on the top row\'s axis', async () => {
  const s = 1000
  // A 10s turn; a subagent runs through its second half and 4s past it.
  const turns: Turn[] = [{ id: 't1', start: 0, end: 10 * s, prompt: 'x', actions: [] }]
  const sp: Span[] = [{ ...bg, start: 5 * s, end: 14 * s }]
  const { top, low } = lanes(sp, turns, 0, 20 * s)
  expect(runs(strip(top, 80, true))).toEqual([{ cat: 'thinking', n: 10 }, { cat: 'gap', n: 4 }])
  expect(runs(strip(low, 80, true))).toEqual([{ cat: 'gap', n: 5 }, { cat: 'agents', n: 9 }])
  // The same axis as the wall-clock strip: idle squeezed out, nothing else.
  expect(strip(sweep(sp, turns, 0, 20 * s), 80, true)).toHaveLength(14)
})

test('the strip covers active time only, left to right', async () => {
  const cols = strip(sweep(spans, [turn], 0, 150), 10)
  expect(cols.length).toBe(10)
  expect(cols[0]).toBe('thinking')
  expect(cols[9]).toBe('thinking')
  expect(runs(cols).some(r => r.cat === 'shell')).toBe(true)
})

// Back-to-back blocks of [category, seconds], as sweep() would cut them.
const seq = (...b: [Cat, number][]): Piece[] => {
  let t = 0
  return b.map(([c, s]) => ({ t0: t, t1: (t += s * 1000), cats: [c] }))
}

test('a second added with room left leaves the drawn columns alone', async () => {
  const before = strip(seq(['thinking', 25], ['shell', 15]), 80, true)
  expect(before).toHaveLength(40) // 1 s per column, not stretched to 80
  const after = strip(seq(['thinking', 25], ['shell', 15], ['reading', 1]), 80, true)
  expect(after).toHaveLength(41)
  expect(after.slice(0, 40)).toEqual(before)
  expect(after[40]).toBe('reading')
})

test('a full bar doubles the scale and still shows the whole session', async () => {
  const full = strip(seq(['thinking', 40], ['shell', 40]), 80, true)
  expect(runs(full)).toEqual([{ cat: 'thinking', n: 40 }, { cat: 'shell', n: 40 }])
  const over = strip(seq(['thinking', 40], ['shell', 41]), 80, true)
  expect(scaleFor(81_000, 80)).toBe(2_000)
  expect(runs(over)).toEqual([{ cat: 'thinking', n: 20 }, { cat: 'shell', n: 21 }])
})

test('a long session on a fresh band takes the smallest step that fits', async () => {
  expect(scaleFor(600_000, 80)).toBe(8_000)
  expect(strip(seq(['thinking', 600]), 80, true)).toHaveLength(75)
  // A new width picks again from the start of the ladder.
  expect(scaleFor(100_000, 80)).toBe(2_000)
  expect(scaleFor(100_000, 120)).toBe(1_000)
})

test('blocks that would split a column get whole columns adding up to the filled width', async () => {
  const cols = strip(seq(['thinking', 10.5], ['shell', 10.5]), 80, true)
  expect(cols).toHaveLength(21)
  const [a, b] = runs(cols)
  expect([10, 11]).toContain(a!.n)
  expect(a!.cat).toBe('thinking')
  expect(b).toEqual({ cat: 'shell', n: 21 - a!.n })
  // Fitted (the panel's bars): each block within one column of its share, the whole width used.
  const fit = runs(strip(seq(['thinking', 1], ['reading', 1], ['shell', 1]), 10))
  expect(fit.map(r => r.n)).toEqual([3, 4, 3])
})

test('redraws at the same scale keep the edges of finished blocks', async () => {
  const head: [Cat, number][] = [['thinking', 12.4], ['reading', 7.6], ['editing', 3.5]]
  const one = runs(strip(seq(...head, ['shell', 10.2]), 80, true))
  const two = runs(strip(seq(...head, ['shell', 11.7]), 80, true))
  expect(two.slice(0, -1)).toEqual(one.slice(0, -1))
})

test('tools map to categories and short labels', async () => {
  expect(catOf('Edit')).toBe('editing')
  expect(catOf('mcp__foo__bar')).toBe('other')
  expect(labelOf({ tool: 'Read', file_path: '/a/b/c/d.ts' })).toBe('Read c/d.ts')
  expect(labelOf({ tool: 'Bash', command: 'npm test', description: 'Run tests' })).toBe('Bash Run tests')
})

test('every category has a default color, a theme key and a glyph of its own', async () => {
  const cats = Object.keys(CATS) as Cat[]
  expect(cats).toHaveLength(8)
  for (const c of cats) {
    expect(CATS[c].color).toMatch(/^#[0-9A-F]{6}$/)
    expect(CATS[c].theme.length > 0).toBe(true)
    expect([...CATS[c].glyph]).toHaveLength(1)
  }
  expect(new Set(cats.map(c => CATS[c].glyph)).size).toBe(8)
  expect(new Set(cats.map(c => CATS[c].color)).size).toBe(8)
  // The proposal's Option 1, as the "Thinking beside Asking you" scenario names it.
  expect(CATS.thinking.color).toBe('#C8601A')
  expect(CATS.asking.color).toBe('#2FA88A')
})

test('the palette setting picks default colors or theme keys, anything unknown falling back to default', async () => {
  expect(colorOf('shell', 'theme')).toBe('bashBorder')
  expect(colorOf('shell', 'default')).toBe(CATS.shell.color)
  expect(colorOf('shell', undefined)).toBe(CATS.shell.color)
  expect(colorOf('shell', 'neon')).toBe(CATS.shell.color)
})
