export type Cat = 'thinking' | 'reading' | 'editing' | 'shell' | 'web' | 'agents' | 'asking' | 'other'
export type Span = { id: string; cat: Cat; label: string; start: number; end?: number }
export type Turn = {
  id: string
  start: number
  end?: number
  prompt: string
  actions: string[]
  tools?: Record<string, number> // calls per tool, subagents' included; uncapped, unlike actions
  summary?: string
  isAborted?: boolean
}

// A divider in the timeline: where the conversation was cleared or compacted.
export type Mark = { at: number; kind: 'clear' | 'compact'; isAuto?: boolean }

// One line of the turn log, ~/.claude/visual-recap/turns/<session>.jsonl. Times are epoch ms.
// `time` is the turn's active time per category; it sums to `ms` less any rounding.
export type TurnRecord = {
  v: 1
  session: string
  turn: string
  start: number
  end: number
  ms: number
  isAborted: boolean
  project: string
  root: string
  model?: string
  tokens?: { input: number; output: number; cacheRead: number; cacheWrite: number }
  time: Partial<Record<Cat, number>>
  tools: Record<string, number>
  prompt: string
  summary?: string
}

export type Week = { week: string; turns: number; ms: number; time: Partial<Record<Cat, number>> }
export type History = {
  turns: number
  sessions: number
  ms: number
  tokens: number
  weeks: Week[] // newest first
  projects: { name: string; turns: number; ms: number }[]
  tools: { name: string; n: number }[]
}

declare module 'claude-code' {
  interface PluginState {
    'visual-recap': { spans: Span[]; turns: Turn[]; now: number; startedAt: number; frame: number; marks: Mark[]; history: History | null }
  }
}
