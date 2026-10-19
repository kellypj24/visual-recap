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

test('with the band off the panel clock still ticks', { options: { showBand: false } }, async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  await clock.advance(10_000)
  await $.turn.start({ text: 'fix the bug', turnId: 't1' })
  await clock.advance(5_000)

  const pane = await $.ui.mount({
    plugin: 'visual-recap',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'visual-recap',
    props: { title: 'Recap', isFocused: false, bodyColumns: 50, placement: 'dock', scroll, view: {} } as never,
  })
  expect(await pane.find({ text: /Session 5s/ })).toBeDefined()
  await pane.unmount()
})
