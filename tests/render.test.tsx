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

test('finished turns go to the log and /visual-recap history draws them', async ($, on) => {
  const clock = mock.clock(on, { now: new Date(2026, 9, 14, 10).getTime() })
  mock.env(on, { HOME: '/home/u' })
  const files = new Map<string, string>()
  on('fs.read', ($, e) => {
    const text = files.get(e.path)
    if (text === undefined) throw new Error('ENOENT')
    return { value: text }
  })
  on('fs.write', ($, e) => (files.set(e.path, e.text), { value: undefined }))
  on('fs.list', () => ({
    value: [...files.keys()].map(k => ({ name: k.split('/').at(-1)!, kind: 'file' as const, size: 1, mtimeMs: clock.now(), isLink: false })),
  }))
  on('session.id', () => ({ value: 's1' }))
  on('session.root', () => ({ value: '/w/app' }))
  on('session.repo', () => ({ value: null }))
  on('model.complete', () => ({ value: { isAnswered: true, text: 'Fixed the bug.' } }) as never)
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('tool.call', async () => {
    await clock.advance(4_000)
    return { result: 'ok' }
  })
  on('ui.open', () => ({ value: {} }) as never)

  await $.turn.start({ text: 'fix the bug', turnId: 't1' })
  await $.tool.call({ tool: 'Bash', command: 'npm test' } as never)
  await clock.advance(1_000)
  await $.turn.complete({ answer: 'fixed', durationMs: 5_000, isAborted: false, turnId: 't1', reason: 'answer' })
  await clock.advance(10)

  const log = files.get('/home/u/.claude/visual-recap/turns/s1.jsonl')
  expect(log).toBeDefined()
  expect(log!.trim().split('\n').length).toBe(1)
  const rec = JSON.parse(log!)
  expect(rec.project).toBe('app')
  expect(rec.tools).toEqual({ Bash: 1 })
  expect(rec.time.shell).toBe(4_000)
  expect(rec.summary).toBe('Fixed the bug.')

  await $.command.run({ command: 'visual-recap', args: 'history' } as never)
  for (const surface of ['terminal', 'desktop'] as const) {
    const pane = await $.ui.mount({
      plugin: 'visual-recap',
      surface,
      component: 'Pane',
      requestId: 'visual-recap-history',
      props: { title: 'Recap history', isFocused: false, bodyColumns: 50, placement: 'dock', scroll, view: {} } as never,
    })
    expect(await pane.find({ text: /1 turn · 1 session/ })).toBeDefined()
    expect(await pane.find({ text: /^app/ })).toBeDefined()
    expect(await pane.find({ text: /^Bash/ })).toBeDefined()
    await pane.unmount()
  }
})
