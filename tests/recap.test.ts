import { expect, test } from 'claude-code/testing'

import type { Span, Turn } from '../types'
import { catOf, labelOf, runs, strip, sweep, totals } from '../hooks/recap'

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
  expect(catOf('mcp__Claude_Browser__navigate')).toBe('web')
  expect(catOf('mcp__remote-devices__Claude_Browser__navigate')).toBe('web')
  expect(catOf('mcp__claude-in-chrome__navigate')).toBe('web')
  expect(catOf('mcp__Claude_in_Chrome__navigate')).toBe('web')
  expect(catOf('mcp__claude-in-chrome-foo__navigate')).toBe('other')
  expect(catOf('ListAgents')).toBe('agents')
  // TaskStop also stops background shells and Monitor, so it can't count as Subagents.
  expect(catOf('TaskStop')).toBe('shell')
  expect(catOf('mcp__foo__bar')).toBe('other')
  expect(labelOf({ tool: 'Read', file_path: '/a/b/c/d.ts' })).toBe('Read c/d.ts')
  expect(labelOf({ tool: 'Bash', command: 'npm test', description: 'Run tests' })).toBe('Bash Run tests')
})
