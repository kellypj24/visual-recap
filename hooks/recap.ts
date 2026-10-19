import type { Cat, History, Span, Turn, TurnRecord, Week } from '../types'

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

export type RecordInfo = {
  session: string
  project: string
  root: string
  usage?: { model: string; input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number }
}

// What a finished turn writes to the log: its active time per category, its tool counts, its tokens.
export function turnRecord(turn: Turn, spans: readonly Span[], info: RecordInfo): TurnRecord {
  const end = turn.end ?? turn.start
  const mine = spans.filter(x => x.start < end && (x.end ?? end) > turn.start)
  const time: Partial<Record<Cat, number>> = {}
  for (const [c, ms] of Object.entries(totals(sweep(mine, [turn], turn.start, end)))) {
    if (c !== 'idle' && ms >= 1) time[c as Cat] = Math.round(ms)
  }
  const u = info.usage
  return {
    v: 1,
    session: info.session,
    turn: turn.id,
    start: turn.start,
    end,
    ms: end - turn.start,
    isAborted: turn.isAborted ?? false,
    project: info.project,
    root: info.root,
    ...(u
      ? {
          model: u.model,
          tokens: {
            input: u.input_tokens,
            output: u.output_tokens,
            cacheRead: u.cache_read_input_tokens,
            cacheWrite: u.cache_creation_input_tokens,
          },
        }
      : {}),
    time,
    tools: turn.tools ?? {},
    prompt: turn.prompt,
    ...(turn.summary !== undefined ? { summary: turn.summary } : {}),
  }
}

// Replaces the line for the same turn, or appends one.
export function upsertLine(jsonl: string, rec: TurnRecord): string {
  const lines = jsonl.split('\n').filter(l => l.trim() !== '')
  const i = lines.findIndex(l => parseRecord(l)?.turn === rec.turn)
  const line = JSON.stringify(rec)
  if (i < 0) lines.push(line)
  else lines[i] = line
  return lines.join('\n') + '\n'
}

export function parseRecord(line: string): TurnRecord | undefined {
  try {
    const r = JSON.parse(line) as TurnRecord
    return r && r.v === 1 && typeof r.start === 'number' ? r : undefined
  } catch {
    return undefined
  }
}

// The Monday of `ms`'s week, local time, as YYYY-MM-DD.
export function weekOf(ms: number): string {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function historyOf(records: readonly TurnRecord[], topTools = 8): History {
  const weeks = new Map<string, Week>()
  const projects = new Map<string, { name: string; turns: number; ms: number }>()
  const tools = new Map<string, number>()
  const sessions = new Set<string>()
  let ms = 0
  let tokens = 0
  for (const r of records) {
    const active = Object.values(r.time).reduce((n, x) => n + (x ?? 0), 0)
    sessions.add(r.session)
    ms += active
    tokens += r.tokens ? r.tokens.input + r.tokens.output + r.tokens.cacheRead + r.tokens.cacheWrite : 0
    const key = weekOf(r.start)
    const w = weeks.get(key) ?? { week: key, turns: 0, ms: 0, time: {} }
    w.turns++
    w.ms += active
    for (const [c, x] of Object.entries(r.time) as [Cat, number][]) w.time[c] = (w.time[c] ?? 0) + x
    weeks.set(key, w)
    const p = projects.get(r.project) ?? { name: r.project, turns: 0, ms: 0 }
    p.turns++
    p.ms += active
    projects.set(r.project, p)
    for (const [t, n] of Object.entries(r.tools)) tools.set(t, (tools.get(t) ?? 0) + n)
  }
  return {
    turns: records.length,
    sessions: sessions.size,
    ms,
    tokens,
    weeks: [...weeks.values()].sort((a, b) => (a.week < b.week ? 1 : -1)),
    projects: [...projects.values()].sort((a, b) => b.ms - a.ms),
    tools: [...tools].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n).slice(0, topTools),
  }
}

// A bar `width` columns long at full scale, cut into categories by their share of `time`.
export function catBar(time: Partial<Record<Cat, number>>, scale: number, width: number): { cat: Cat; n: number }[] {
  const cats = (Object.keys(CATS) as Cat[]).filter(c => (time[c] ?? 0) > 0)
  const out: { cat: Cat; n: number }[] = []
  let acc = 0
  let drawn = 0
  for (const c of cats) {
    acc += time[c]!
    const upto = scale > 0 ? Math.round((acc / scale) * width) : 0
    if (upto > drawn) out.push({ cat: c, n: upto - drawn })
    drawn = Math.max(drawn, upto)
  }
  return out
}

export function fmtTokens(n: number): string {
  if (n < 1000) return String(n)
  if (n < 1e6) return `${Math.round(n / 1000)}k`
  return `${(n / 1e6).toFixed(n < 1e7 ? 1 : 0)}M`
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}
