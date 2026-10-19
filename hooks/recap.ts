import type { Cat, Span, Turn } from '../types'

export const CATS: Record<Cat, { label: string; color: string }> = {
  thinking: { label: 'Thinking', color: '#D97757' },
  reading: { label: 'Reading', color: '#5B9BD5' },
  editing: { label: 'Editing', color: '#6BBF59' },
  shell: { label: 'Shell', color: '#C678DD' },
  web: { label: 'Web', color: '#4FB6C2' },
  agents: { label: 'Subagents', color: '#E5C07B' },
  asking: { label: 'Asking you', color: '#E06C75' },
  other: { label: 'Other tools', color: '#9DA5B4' },
}

export function catOf(tool: string): Cat {
  if (/^(Read|Grep|Glob|LS|NotebookRead|LSP|ToolSearch)$/.test(tool)) return 'reading'
  if (/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(tool)) return 'editing'
  if (/^(Bash|BashOutput|KillShell|PowerShell|Monitor)$/.test(tool)) return 'shell'
  if (/^(WebFetch|WebSearch)$|^mcp__claude-in-chrome|^mcp__(remote-devices__)?Claude_Browser__/.test(tool)) return 'web'
  if (/^(Agent|Task|SendMessage|ListAgents|TaskStop)$/.test(tool)) return 'agents'
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

// Splits [from, to] into pieces by what was running: tools win, else thinking
// inside a turn, else idle. Parallel tools share a piece.
export function sweep(spans: readonly Span[], turns: readonly Turn[], from: number, to: number): Piece[] {
  const ev: [number, number, string][] = []
  for (const t of turns) ev.push([t.start, 1, 'turn'], [t.end ?? to, -1, 'turn'])
  for (const s of spans) ev.push([s.start, 1, s.cat], [s.end ?? to, -1, s.cat])
  ev.sort((a, b) => a[0] - b[0])
  const open = new Map<string, number>()
  const current = (): Piece['cats'] => {
    const tools = [...open].filter(([k, n]) => k !== 'turn' && n > 0).map(([k]) => k as Cat)
    if (tools.length) return tools
    return (open.get('turn') ?? 0) > 0 ? ['thinking'] : ['idle']
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

// One category per column over agent-active time (idle squeezed out).
export function strip(pieces: readonly Piece[], width: number): Cat[] {
  const active = pieces.filter(p => p.cats[0] !== 'idle')
  const total = active.reduce((n, p) => n + p.t1 - p.t0, 0)
  if (total <= 0 || width <= 0) return []
  const cols: Partial<Record<Cat, number>>[] = Array.from({ length: width }, () => ({}))
  let off = 0
  for (const p of active) {
    const end = off + p.t1 - p.t0
    const c1 = Math.min(width - 1, Math.floor((end / total) * width))
    for (let c = Math.floor((off / total) * width); c <= c1; c++) {
      const seg = Math.min(end, ((c + 1) * total) / width) - Math.max(off, (c * total) / width)
      if (seg <= 0) continue
      for (const k of p.cats as Cat[]) cols[c]![k] = (cols[c]![k] ?? 0) + seg / p.cats.length
    }
    off = end
  }
  let last: Cat = 'thinking'
  return cols.map(m => {
    const best = (Object.entries(m) as [Cat, number][]).sort((a, b) => b[1] - a[1])[0]
    return (last = best ? best[0] : last)
  })
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
