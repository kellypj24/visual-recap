import { expect, test } from 'claude-code/testing'

import type { Span, Turn } from '../types'
import { catBar, catOf, historyOf, labelOf, runs, strip, sweep, totals, turnRecord, upsertLine, weekOf } from '../hooks/recap'

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

test('the strip covers active time only, left to right', async () => {
  const cols = strip(sweep(spans, [turn], 0, 150), 10)
  expect(cols.length).toBe(10)
  expect(cols[0]).toBe('thinking')
  expect(cols[9]).toBe('thinking')
  expect(runs(cols).some(r => r.cat === 'shell')).toBe(true)
})

test('tools map to categories and short labels', async () => {
  expect(catOf('Edit')).toBe('editing')
  expect(catOf('mcp__foo__bar')).toBe('other')
  expect(labelOf({ tool: 'Read', file_path: '/a/b/c/d.ts' })).toBe('Read c/d.ts')
  expect(labelOf({ tool: 'Bash', command: 'npm test', description: 'Run tests' })).toBe('Bash Run tests')
})

const info = { session: 's1', project: 'app', root: '/w/app' }

test('a turn record holds active time per category, tools and tokens', async () => {
  const rec = turnRecord({ ...turn, tools: { Read: 1, Bash: 1 } }, spans, {
    ...info,
    usage: { model: 'm', input_tokens: 5, output_tokens: 2, cache_read_input_tokens: 10, cache_creation_input_tokens: 1 },
  })
  expect(rec.ms).toBe(100)
  expect(rec.time).toEqual({ thinking: 70, reading: 15, shell: 15 })
  expect(rec.tools).toEqual({ Read: 1, Bash: 1 })
  expect(rec.tokens).toEqual({ input: 5, output: 2, cacheRead: 10, cacheWrite: 1 })
})

test('the log replaces a turn line instead of adding a second', async () => {
  const rec = turnRecord(turn, spans, info)
  const once = upsertLine('', rec)
  const twice = upsertLine(once, { ...rec, summary: 'did it' })
  expect(twice.trim().split('\n').length).toBe(1)
  expect(twice).toContain('did it')
  expect(upsertLine(twice, { ...rec, turn: 'u' }).trim().split('\n').length).toBe(2)
})

test('history sums by week, project and tool', async () => {
  const mon = new Date(2026, 9, 12, 9).getTime() // a Monday
  const a = turnRecord({ ...turn, start: mon, end: mon + 100, tools: { Bash: 3 } }, [], info)
  const b = turnRecord({ ...turn, id: 'u', start: mon + 86_400_000, end: mon + 86_400_050, tools: { Bash: 1, Read: 2 } }, [], { ...info, project: 'lib' })
  const c = turnRecord({ ...turn, id: 'v', start: mon + 7 * 86_400_000, end: mon + 7 * 86_400_000 + 10 }, [], { ...info, session: 's2' })
  const h = historyOf([a, b, c])
  expect(weekOf(mon + 6 * 86_400_000)).toBe('2026-10-12')
  expect(h.weeks.map(w => [w.week, w.turns, w.ms])).toEqual([['2026-10-19', 1, 10], ['2026-10-12', 2, 150]])
  expect(h.projects[0]).toEqual({ name: 'app', turns: 2, ms: 110 })
  expect(h.tools).toEqual([{ name: 'Bash', n: 4 }, { name: 'Read', n: 2 }])
  expect(h.sessions).toBe(2)
})

test('a week bar is scaled to the busiest week', async () => {
  expect(catBar({ reading: 25, shell: 25 }, 100, 10)).toEqual([{ cat: 'reading', n: 3 }, { cat: 'shell', n: 2 }])
})
