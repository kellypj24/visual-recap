import { expect, mock, test } from 'claude-code/testing'

const pane = {
  title: 'Recap',
  isFocused: false,
  bodyColumns: 50,
  placement: 'dock',
  scroll: { offset: 0, bodyRows: 20 },
  view: {},
} as never

test('a resumed session gets its recap back', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  mock.store(on, {
    sessions: ['s1'],
    's:s1': {
      startedAt: 1_000,
      now: 9_000,
      marks: [],
      spans: [{ id: '', cat: 'shell', label: '', start: 2_000, end: 5_000 }],
      turns: [{ id: 't1', start: 1_500, end: 8_000, prompt: 'run tests', actions: [], summary: 'Ran the tests.' }],
    },
  })
  on('session.id', () => ({ value: 's1' }))
  on('command.register', () => ({ value: undefined }) as never)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  await clock.advance(60_000)
  await $.session.start({ cwd: '/x', surface: 'terminal', isInteractive: true })

  const view = await $.ui.mount({ plugin: 'visual-recap', surface: 'terminal', component: 'Pane', requestId: 'visual-recap', props: pane })
  expect(await view.find({ text: /Ran the tests\./ })).toBeDefined()
  expect(await view.find({ text: /Shell/ })).toBeDefined()
  await view.unmount()
})
