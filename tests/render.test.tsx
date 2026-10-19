import { expect, mock, test } from 'claude-code/testing'

const scroll = { offset: 0, bodyRows: 20 }

test('band and pane draw a turn with a tool call on terminal and desktop', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
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
})
