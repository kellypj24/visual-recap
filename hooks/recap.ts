import type { ThemeKey } from 'claude-code'

import type { Cat, Span, Turn } from '../types'

// color: the default palette. theme: the key the `theme` palette follows. glyph: told apart without color.
export const CATS: Record<Cat, { label: string; color: string; theme: ThemeKey; glyph: string }> = {
  thinking: { label: 'Thinking', color: '#C8601A', theme: 'claude', glyph: '█' },
  reading: { label: 'Reading', color: '#37A8EC', theme: 'suggestion', glyph: '▓' },
  editing: { label: 'Editing', color: '#68BE1F', theme: 'diffAdded', glyph: '▒' },
  shell: { label: 'Shell', color: '#9F43C3', theme: 'bashBorder', glyph: '▚' },
  web: { label: 'Web', color: '#D3316A', theme: 'ide', glyph: '▌' },
  agents: { label: 'Subagents', color: '#5978FD', theme: 'planMode', glyph: '▐' },
  asking: { label: 'Asking you', color: '#2FA88A', theme: 'permission', glyph: '▞' },
  other: { label: 'Other tools', color: '#8A8F98', theme: 'inactive', glyph: '░' },
}

// The `palette` setting: `theme` follows the person's Claude Code theme; anything else is the default palette.
export function colorOf(cat: Cat, palette: unknown): string {
  return palette === 'theme' ? CATS[cat].theme : CATS[cat].color
}

export function catOf(tool: string): Cat {
  if (/^(Read|Grep|Glob|LS|NotebookRead|LSP|ToolSearch)$/.test(tool)) return 'reading'
  if (/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(tool)) return 'editing'
  if (/^(Bash|BashOutput|KillShell|PowerShell|Monitor)$/.test(tool)) return 'shell'
  if (/^(WebFetch|WebSearch)$|^mcp__claude-in-chrome/.test(tool)) return 'web'
  if (/^(Agent|Task|SendMessage)$/.test(tool)) return 'agents'
  if (/^(AskUserQuestion|ExitPlanMode)$/.test(tool)) return 'asking'
  return 'other'
}

const LABEL_KEYS = ['description', 'file_path', 'notebook_path', 'pattern', 'command', 'url', 'query', 'path']

export function labelOf(input: Record<string, unknown>): string {
  const key = LABEL_KEYS.find(k => typeof input[k] === 'string' && input[k] !== '')
  let arg = key ? String(input[key]).split('\n')[0]! : ''
  if (key && /path/.test(key)) arg = arg.split('/').slice(-2).join('/')
  return `${String(input.tool)}${arg ? ` ${arg}` : ''}`.slice(0, 100)
}

export type Piece = { t0: number; t1: number; cats: (Cat | 'idle')[] }

// Splits [from, to] into pieces by what was running: main-loop tools win, else thinking
// inside a turn, else a subagent's own run, else idle. Parallel tools share a piece.
export function sweep(spans: readonly Span[], turns: readonly Turn[], from: number, to: number): Piece[] {
  const ev: [number, number, string][] = []
  for (const t of turns) ev.push([t.start, 1, 'turn'], [t.end ?? to, -1, 'turn'])
  // A subagent's run (agentId set) is background: it fills only time the main loop leaves idle.
  for (const s of spans) {
    const k = s.agentId === undefined ? s.cat : 'subagent'
    ev.push([s.start, 1, k], [s.end ?? to, -1, k])
  }
  ev.sort((a, b) => a[0] - b[0])
  const open = new Map<string, number>()
  const current = (): Piece['cats'] => {
    const tools = [...open].filter(([k, n]) => k !== 'turn' && k !== 'subagent' && n > 0).map(([k]) => k as Cat)
    if (tools.length) return tools
    if ((open.get('turn') ?? 0) > 0) return ['thinking']
    return (open.get('subagent') ?? 0) > 0 ? ['agents'] : ['idle']
  }
  const out: Piece[] = []
  let prev = from
  for (const [t, d, k] of ev) {
    const at = Math.min(Math.max(t, from), to)
    if (at > prev) {
      out.push({ t0: prev, t1: at, cats: current() })
      prev = at
    }
    open.set(k, (open.get(k) ?? 0) + d)
  }
  if (to > prev) out.push({ t0: prev, t1: to, cats: current() })
  return out
}

export function totals(pieces: readonly Piece[]): Partial<Record<Cat | 'idle', number>> {
  const tot: Partial<Record<Cat | 'idle', number>> = {}
  for (const p of pieces) {
    for (const c of p.cats) tot[c] = (tot[c] ?? 0) + (p.t1 - p.t0) / p.cats.length
  }
  return tot
}

// Seconds per column for the band: the smallest step of 1 s, 2 s, 4 s, ... at which `activeMs` fits in `width`.
// It only moves when the bar fills, so between rescales blocks already drawn keep their columns.
export function scaleFor(activeMs: number, width: number): number {
  let ms = 1000
  while (activeMs > width * ms) ms *= 2
  return ms
}

// One category per column over agent-active time (idle squeezed out). Blocks (runs of one
// category; parallel pieces split their time) end at column round(time before their end / scale),
// so each gets a whole number of columns and no edge moves while the scale holds.
// zoom: fill from the left at scaleFor(); otherwise fit the whole width.
export function strip(pieces: readonly Piece[], width: number, zoom = false): Cat[] {
  const blocks: { cat: Cat; end: number }[] = []
  let total = 0
  for (const p of pieces) {
    if (p.cats[0] === 'idle') continue
    for (const cat of p.cats as Cat[]) {
      total += (p.t1 - p.t0) / p.cats.length
      if (blocks.at(-1)?.cat === cat) blocks.at(-1)!.end = total
      else blocks.push({ cat, end: total })
    }
  }
  if (total <= 0 || width <= 0) return []
  const scale = zoom ? scaleFor(total, width) : total / width
  const filled = zoom ? Math.max(1, Math.round(total / scale)) : width
  const cols: Cat[] = []
  blocks.forEach((b, i) => {
    const to = i === blocks.length - 1 ? filled : Math.round(b.end / scale)
    while (cols.length < to) cols.push(b.cat)
  })
  return cols
}

export function runs(cols: readonly Cat[]): { cat: Cat; n: number }[] {
  const out: { cat: Cat; n: number }[] = []
  for (const cat of cols) {
    const tail = out[out.length - 1]
    if (tail?.cat === cat) tail.n++
    else out.push({ cat, n: 1 })
  }
  return out
}

export function fmt(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m${String(s % 60).padStart(2, '0')}s`
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}m`
}

export function summaryPrompt(turn: Turn, answer: string): string {
  return [
    'Summarize what an AI coding agent did in one turn of a session as ONE plain sentence,',
    'at most 20 words, past tense, no preamble, no quotes.',
    '',
    `The user asked: ${turn.prompt || '(continuation, no new prompt)'}`,
    'Actions, in order:',
    ...(turn.actions.length ? turn.actions.map(a => `- ${a}`) : ['- (none)']),
    `The agent's final reply (excerpt): ${answer.slice(0, 800)}`,
  ].join('\n')
}

export function fallbackSummary(turn: Turn): string {
  if (!turn.actions.length) return turn.prompt ? `Replied to: ${turn.prompt.slice(0, 80)}` : 'Replied.'
  return `${turn.actions.length} actions: ${turn.actions.slice(0, 3).join(', ')}`
}
