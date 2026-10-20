export type Cat = 'thinking' | 'reading' | 'editing' | 'shell' | 'web' | 'agents' | 'asking' | 'other'
// A subagent's own run is a span too (agentId set), tied to the main turn that spawned it.
export type Span = { id: string; cat: Cat; label: string; start: number; end?: number; agentId?: string; turnId?: string }
export type Turn = {
  id: string
  start: number
  end?: number
  prompt: string
  actions: string[]
  summary?: string
  isAborted?: boolean
}

// A subagent as agent.spawn named it: its label and the main turn that spawned it.
export type Agent = { label: string; turnId?: string }

// A divider in the timeline: where the conversation was cleared or compacted.
export type Mark = { at: number; kind: 'clear' | 'compact'; isAuto?: boolean }

// The band's two views: wall-clock time, or the work mix with subagents on a row of their own.
export type BandView = 'wall' | 'work'

declare module 'claude-code' {
  interface PluginState {
    'visual-recap': { spans: Span[]; turns: Turn[]; now: number; startedAt: number; frame: number; marks: Mark[]; agents: Record<string, Agent>; view: BandView | null }
  }
}
