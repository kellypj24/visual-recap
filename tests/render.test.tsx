import { expect, mock, test } from 'claude-code/testing'

const scroll = { offset: 0, bodyRows: 20 }

test('band and pane draw a turn with a tool call on terminal and desktop', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('session.compact', () => ({ messages: [{ role: 'user', text: 'summary', toolUses: [] }] }))
  on('session.end', ($, e) => ({ sessionId: e.sessionId }))
  on('tool.call', async () => {
    await clock.advance(4_000)
    return { result: 'ok' }
  })
  await clock.advance(10_000)
  await $.turn.start({ text: 'fix the bug', turnId: 't1' })
  await clock.advance(3_000)
  await $.tool.call({ tool: 'mcp__x__y' } as never)

  for (const surface of ['terminal', 'desktop'] as const) {
    const band = await $.ui.mount({
      plugin: 'visual-recap',
      surface,
      component: 'AbovePrompt',
      props: { hasSurvey: false, isWorking: true, maxRows: 10, bodyColumns: 80, scroll, view: {} } as never,
    })
    expect(await band.find({ text: /Thinking/ })).toBeDefined()
    await band.unmount()

    const pane = await $.ui.mount({
      plugin: 'visual-recap',
      surface,
      component: 'Pane',
      requestId: 'visual-recap',
      props: { title: 'Recap', isFocused: false, bodyColumns: 50, placement: 'dock', scroll, view: {} } as never,
    })
    expect(await pane.find({ text: /Working: fix the bug/ })).toBeDefined()
    expect(await pane.find({ text: /Other tools/ })).toBeDefined()
    await pane.unmount()
  }

  // Once the turn ends the band says so, instead of animating.
  await clock.advance(2_000)
  await $.turn.complete({ answer: 'fixed', durationMs: 9_000, isAborted: false, turnId: 't1', reason: 'answer' })
  const band = await $.ui.mount({
    plugin: 'visual-recap',
    surface: 'terminal',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 80, scroll, view: {} } as never,
  })
  expect(await band.find({ text: /Done in 9s · waiting on you/ })).toBeDefined()
  await band.unmount()

  // Compacting and clearing leave dividers in the timeline.
  await $.session.compact({ trigger: 'auto', messages: [{ role: 'user', text: 'summary', toolUses: [] }] })
  await $.session.end({ reason: 'clear', sessionId: 's1' } as never)
  const pane = await $.ui.mount({
    plugin: 'visual-recap',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'visual-recap',
    props: { title: 'Recap', isFocused: false, bodyColumns: 50, placement: 'dock', scroll, view: {} } as never,
  })
  expect(await pane.find({ text: /── Auto-compacted · \+/ })).toBeDefined()
  expect(await pane.find({ text: /── Cleared · \+/ })).toBeDefined()
  await pane.unmount()
})

const pane = { title: 'Recap', isFocused: false, bodyColumns: 50, placement: 'dock', scroll, view: {} } as never

test('time the model spends writing a tool call counts as that tool, not thinking', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.step', async function* (_$, e) {
    yield { kind: 'thinking', index: 0, text: 'hmm' } as const
    await clock.sleep(2_000)
    yield { kind: 'tool', index: 1, id: 'w1', name: 'Write' } as const
    await clock.sleep(30_000)
    yield { kind: 'input', index: 1, json: '{"file_path":"a.ts","content":"x"}' } as const
    yield { kind: 'stop', stopReason: 'tool_use', usage: null } as const
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'tool_use', usage: null }
  })
  await $.turn.start({ text: 'write it', turnId: 't1' })
  const step = $.turn.step({ turnId: 't1', index: 0, model: 'm', messageCount: 1 })
  const drain = (async () => { for await (const _ of step) void _ })()
  await clock.advance(32_000)
  await drain

  const view = await $.ui.mount({ plugin: 'visual-recap', surface: 'terminal', component: 'Pane', requestId: 'visual-recap', props: pane })
  expect(await view.find({ text: /Editing.* 30s/ })).toBeDefined()
  expect(await view.find({ text: /Thinking.*  2s/ })).toBeDefined()
  await view.unmount()
})

const bandProps = { hasSurvey: false, isWorking: true, maxRows: 10, bodyColumns: 80, scroll, view: {} } as never

// The strip line as one color per column, the pulsing leading edge left off.
async function stripCols(band: { find: (q: { type: string; text: RegExp }) => Promise<{ children: unknown[] } | undefined> }) {
  const line = await band.find({ type: 'Text', text: /^▆/ })
  const parts = (line?.children ?? []) as { props: { color?: string }; children: string[] }[]
  return parts.slice(0, -1).flatMap(p => Array.from(p.children.join(''), () => p.props.color))
}

test('a second later the band keeps the blocks it drew, on terminal and desktop', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('tool.call', async () => {
    await clock.advance(4_000)
    return { result: 'ok' }
  })
  await $.turn.start({ text: 'go', turnId: 't1' })
  await clock.advance(3_000)
  await $.tool.call({ tool: 'Bash', command: 'make' } as never)
  await clock.advance(2_000)

  const before = new Map<string, (string | undefined)[]>()
  for (const surface of ['terminal', 'desktop'] as const) {
    const band = await $.ui.mount({ plugin: 'visual-recap', surface, component: 'AbovePrompt', props: bandProps })
    before.set(surface, await stripCols(band))
    await band.unmount()
  }
  await clock.advance(1_000)
  for (const surface of ['terminal', 'desktop'] as const) {
    const band = await $.ui.mount({ plugin: 'visual-recap', surface, component: 'AbovePrompt', props: bandProps })
    const was = before.get(surface)!
    const cols = await stripCols(band)
    expect(was).toHaveLength(9) // 9 s at 1 s per column, not stretched across 79
    expect(cols).toHaveLength(10)
    expect(cols.slice(0, 9)).toEqual(was)
    await band.unmount()
  }
})

const band = { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 80, scroll, view: {} } as never
const AGENTS_COLOR = '#E5C07B'

test('a background subagent is timed from its own run and its calls stay with the turn that spawned it', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('model.complete', () => ({ value: { isAnswered: false, reason: 'api-error' } }) as never)
  on('agent.spawn', () => ({ model: 'm', agentId: 'a1' }))
  // A background Agent call returns as soon as the subagent is spawned, before the subagent's turn starts.
  on('tool.call', async (_, e) => {
    if (e.tool === 'Agent') await $.agent.spawn({ prompt: 'run the tests', description: 'Run tests' } as never)
    if (e.tool === 'Bash' && e.agentId === undefined) await clock.sleep(6_000)
    return { result: 'ok' }
  })

  await clock.advance(10_000)
  await $.turn.start({ text: 'check the build', turnId: 't1' })
  await clock.advance(1_000)
  await $.tool.call({ tool: 'Agent', description: 'Run tests' } as never)
  await $.turn.start({ text: 'run the tests', turnId: 'a1-t', agentId: 'a1' } as never)
  await clock.advance(1_000)
  await $.turn.complete({ answer: 'started', durationMs: 2_000, isAborted: false, turnId: 't1', reason: 'answer' })

  // The main turn is over but the subagent is still working, under its Agent call's label.
  await clock.advance(5_000)
  let view = await $.ui.mount({ plugin: 'visual-recap', surface: 'terminal', component: 'AbovePrompt', props: band })
  expect(await view.find({ text: /Agent Run tests · 6s/ })).toBeDefined()
  expect(await view.find({ text: /waiting on you/ })).toBeUndefined()
  await view.unmount()

  // The person starts another turn; while the main loop thinks, the band shows that, not the subagent.
  await $.turn.start({ text: 'what time is it', turnId: 't2' })
  await $.tool.call({ tool: 'Bash', command: 'npm test', agentId: 'a1' } as never)
  await clock.advance(4_000)
  for (const surface of ['terminal', 'desktop'] as const) {
    const b = await $.ui.mount({ plugin: 'visual-recap', surface, component: 'AbovePrompt', props: band })
    expect(await b.find({ text: /Thinking · 4s/ })).toBeDefined()
    expect(await b.find({ text: /Agent Run tests ·/ })).toBeUndefined()
    await b.unmount()
    const p = await $.ui.mount({ plugin: 'visual-recap', surface, component: 'Pane', requestId: 'visual-recap', props: pane })
    expect(await p.find({ text: /▶ Thinking · 4s/ })).toBeDefined()
    await p.unmount()
  }
  const bash = $.tool.call({ tool: 'Bash', command: 'date' } as never)
  await clock.advance(6_000)
  await bash
  await $.turn.complete({ answer: 'noon', durationMs: 10_000, isAborted: false, turnId: 't2', reason: 'answer' })
  await clock.advance(4_000)
  await $.turn.complete({ answer: 'passed', durationMs: 22_000, isAborted: false, turnId: 'a1-t', agentId: 'a1', reason: 'answer' } as never)
  view = await $.ui.mount({ plugin: 'visual-recap', surface: 'terminal', component: 'AbovePrompt', props: band })
  expect(await view.find({ text: /waiting on you/ })).toBeDefined()
  await view.unmount()

  for (const surface of ['terminal', 'desktop'] as const) {
    const view = await $.ui.mount({ plugin: 'visual-recap', surface, component: 'Pane', requestId: 'visual-recap', props: pane })
    // The main loop's time stands: t2's Bash and both turns' thinking. The subagent fills only the gaps.
    expect(await view.find({ text: /Shell.*  6s/ })).toBeDefined()
    expect(await view.find({ text: /Thinking.*  6s/ })).toBeDefined()
    expect(await view.find({ text: /Subagents.*  9s/ })).toBeDefined()
    // The subagent's call went to t1, not t2, and no turn's bar takes the subagent's colour.
    expect(await view.find({ text: /1 actions: Bash date/ })).toBeDefined()
    const bars = await view.findAll({ type: 'Text', text: /^▆+$/ })
    expect(bars.length).toBeGreaterThan(0)
    expect(bars.some(b => b.props.color === AGENTS_COLOR)).toBe(false)
    await view.unmount()
  }
})

test('parallel Agent calls each label their own subagent', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('model.complete', () => ({ value: { isAnswered: false, reason: 'api-error' } }) as never)
  // Here each subagent's turn starts before its spawn resolves.
  on('agent.spawn', async (_, e) => {
    const agentId = e.description.split(' ')[1]!
    await $.turn.start({ text: e.prompt, turnId: `${agentId}-t`, agentId } as never)
    return { model: 'm', agentId }
  })
  on('tool.call', async (_, e) => {
    const { description } = e as unknown as { description: string }
    await $.agent.spawn({ prompt: 'look', description } as never)
    return { result: 'ok' }
  })
  const end = (agentId: string) =>
    $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: `${agentId}-t`, agentId, reason: 'answer' } as never)
  const liveText = async () => {
    const view = await $.ui.mount({ plugin: 'visual-recap', surface: 'terminal', component: 'AbovePrompt', props: band })
    const found = await view.find({ text: /Explore \w+ ·/ })
    await view.unmount()
    return found?.text.match(/Explore \w+/)?.[0]
  }

  await $.turn.start({ text: 'map the app', turnId: 't1' })
  await Promise.all(['auth', 'db', 'ui'].map(x => $.tool.call({ tool: 'Agent', description: `Explore ${x}` } as never)))
  await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer' })
  await clock.advance(2_000)
  expect(await liveText()).toBe('Explore ui')
  await end('ui')
  expect(await liveText()).toBe('Explore db')
  await end('db')
  expect(await liveText()).toBe('Explore auth')
})

test("a nested subagent's calls go to the turn that launched its parent", async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('model.complete', () => ({ value: { isAnswered: false, reason: 'api-error' } }) as never)
  on('agent.spawn', (_, e) => ({ model: 'm', agentId: e.parentAgentId === undefined ? 'A' : 'B' }))
  on('tool.call', () => ({ result: 'ok' }))

  await $.turn.start({ text: 'audit', turnId: 't1' })
  await $.tool.call({ tool: 'Agent', description: 'Audit' } as never)
  await $.agent.spawn({ prompt: 'audit', description: 'Audit' } as never)
  await $.turn.start({ text: 'audit', turnId: 'A-t', agentId: 'A' } as never)
  await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer' })
  await $.turn.start({ text: 'what time is it', turnId: 't2' })
  // A, still running for t1, spawns B while t2 is open.
  await $.agent.spawn({ prompt: 'list', description: 'List files', parentAgentId: 'A' } as never)
  await $.turn.start({ text: 'list', turnId: 'B-t', agentId: 'B' } as never)
  await $.tool.call({ tool: 'Bash', command: 'ls', agentId: 'B' } as never)
  await clock.advance(1_000)
  await $.turn.complete({ answer: '', durationMs: 1_000, isAborted: false, turnId: 't2', reason: 'answer' })
  await clock.advance(1_000)

  const view = await $.ui.mount({ plugin: 'visual-recap', surface: 'terminal', component: 'Pane', requestId: 'visual-recap', props: pane })
  expect(await view.find({ text: /2 actions: Agent Audit, ↳ Bash ls/ })).toBeDefined()
  expect(await view.find({ text: /Replied to: what time is it/ })).toBeDefined()
  await view.unmount()
})

test("the Agent call's description labels its subagent when the spawn settles while the subagent's turn starts", async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('model.complete', () => ({ value: { isAnswered: false, reason: 'api-error' } }) as never)
  on('tool.call', () => ({ result: 'ok' }))
  // As Claude Code raises them: the subagent's turn starts while its spawn is still settling, and the
  // whole agent.spawn hook runs between turn.start's read of the agents atom and what turn.start does next.
  let readAgents = () => {}
  let spawned = () => {}
  const hasRead = new Promise<void>(r => (readAgents = r))
  const done = new Promise<void>(r => (spawned = r))
  let isFirstRead = true
  on('agent.spawn', async () => {
    await hasRead
    return { model: 'm', agentId: 'a1' }
  })
  on('state.get', async (_, e, next) => {
    const r = await next(e)
    if (e.key === 'agents' && isFirstRead) {
      isFirstRead = false
      readAgents()
      await done
    }
    return r
  })

  await $.turn.start({ text: 'sleep in the background', turnId: 't1' })
  await $.tool.call({ tool: 'Agent', description: 'Sleep probe' } as never)
  const spawn = $.agent.spawn({ prompt: 'sleep', description: 'Sleep probe', background: true } as never)
  const sub = $.turn.start({ text: 'sleep', turnId: 'a1-t', agentId: 'a1' } as never)
  await spawn
  spawned()
  await sub
  await $.turn.complete({ answer: 'started', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer' })
  await clock.advance(3_000)

  for (const surface of ['terminal', 'desktop'] as const) {
    const b = await $.ui.mount({ plugin: 'visual-recap', surface, component: 'AbovePrompt', props: band })
    expect(await b.find({ text: /Agent Sleep probe · 3s/ })).toBeDefined()
    await b.unmount()
    const p = await $.ui.mount({ plugin: 'visual-recap', surface, component: 'Pane', requestId: 'visual-recap', props: pane })
    expect(await p.find({ text: /▶ Agent Sleep probe · 3s/ })).toBeDefined()
    await p.unmount()
  }
})
