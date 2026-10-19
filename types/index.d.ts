export type Cat = 'thinking' | 'reading' | 'editing' | 'shell' | 'web' | 'agents' | 'asking' | 'other'
export type Span = { id: string; cat: Cat; label: string; start: number; end?: number }
export type Turn = {
  id: string
  start: number
  end?: number
  prompt: string
  actions: string[]
  summary?: string
  isAborted?: boolean
}

// A divider in the timeline: where the conversation was cleared or compacted.
export type Mark = { at: number; kind: 'clear' | 'compact'; isAuto?: boolean }

declare module 'claude-code' {
  interface PluginState {
    'visual-recap': { spans: Span[]; turns: Turn[]; now: number; startedAt: number; frame: number; marks: Mark[]; bandShown: boolean | null }
  }
}
