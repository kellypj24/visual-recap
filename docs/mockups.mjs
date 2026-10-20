// Draws the README mockups as SVG from sample data: `node docs/mockups.mjs`.
// Same glyphs, colors and layout rules as hooks/register.tsx; the numbers are made up.
import { writeFileSync } from 'node:fs'

// [label, default palette color, glyph], as CATS in hooks/recap.ts.
const C = {
  thinking: ['Thinking', '#C8601A', '█'], reading: ['Reading', '#37A8EC', '▓'], editing: ['Editing', '#68BE1F', '▒'],
  shell: ['Shell', '#9F43C3', '▚'], web: ['Web', '#D3316A', '▌'], agents: ['Subagents', '#5978FD', '▐'],
  asking: ['Asking you', '#2FA88A', '▞'], other: ['Other tools', '#8A8F98', '░'],
}
const GLYPHS = '█▓▒▚▌▐▞░'
const BG = '#0d1117', FG = '#d7dade', DIM = '#6f757e', BORDER = '#30363d', WARN = '#E5A50A'
const CW = 7.8, LH = 18, PAD = 18, FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

const fmt = s => (s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`)
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

// A line is a list of [text, style]; style: { color, dim, bold }.
const seg = (text, style = {}) => [text, style]
const dim = text => seg(text, { dim: true })
const bold = text => seg(text, { bold: true })

// seq: [cat, seconds][] in time order -> segments of at most `width` cells. Each block ends at cell
// round(seconds before its end / scale). zoom (the band): 1, 2, 4, ... s per cell, the smallest that
// fits, filled from the left; otherwise (the panel's turn bars) the scale fits the whole width.
// Each block is drawn in its category's glyph; dimmed (the band once done), in the terminal's dim color.
function strip(seq, width, zoom = false, dimmed = false) {
  const total = seq.reduce((n, [, s]) => n + s, 0)
  let scale = total / width
  if (zoom) for (scale = 1; total > width * scale; ) scale *= 2
  const filled = zoom ? Math.max(1, Math.round(total / scale)) : width
  const out = []
  let off = 0, at = 0
  seq.forEach(([cat, s], i) => {
    off += s
    const to = i === seq.length - 1 ? filled : Math.round(off / scale)
    const tail = out[out.length - 1]
    if (to <= at) return
    if (tail && tail[1].cat === cat) tail[0] += C[cat][2].repeat(to - at)
    else out.push(seg(C[cat][2].repeat(to - at), dimmed ? { cat, dim: true } : { cat, color: C[cat][1] }))
    at = to
  })
  return out
}
const totalsOf = seq => {
  const t = {}
  for (const [c, s] of seq) t[c] = (t[c] || 0) + s
  return Object.entries(t).sort((a, b) => b[1] - a[1])
}
const legend = (seq, max = 99) =>
  totalsOf(seq).slice(0, max).flatMap(([c, s]) => [seg(C[c][2], { color: C[c][1] }), dim(` ${C[c][0]} ${fmt(s)}  `)])

// Draws one column of lines at x; returns SVG elements. `{ prompt: cols }` draws the input box.
function column(lines, x, y0) {
  const out = []
  lines.forEach((line, i) => {
    const top = y0 + i * LH
    if (line.prompt) {
      out.push(`<rect x="${x + 0.5}" y="${top + 2.5}" width="${line.prompt * CW}" height="${LH * 2 - 4}" rx="5" fill="none" stroke="${DIM}"/>`)
      out.push(`<text x="${x + CW * 1.5}" y="${top + LH + 4}" fill="${FG}">&gt;</text>`)
      return
    }
    let col = 0
    for (const [text, s] of line) {
      const fill = s.color ?? (s.dim ? DIM : FG)
      for (const run of text.match(new RegExp(`[${GLYPHS}]+|[^${GLYPHS}]+`, 'g')) ?? []) {
        const px = x + col * CW
        if (GLYPHS.includes(run[0])) [...run].forEach((g, i) => out.push(cell(g, px + i * CW, top, fill)))
        // Each word at its own column: browsers collapse spaces, so spacing never comes from the text itself.
        else
          for (const m of run.matchAll(/\S+/g))
            out.push(`<text x="${px + m.index * CW}" y="${top + LH * 0.72}" textLength="${m[0].length * CW}" lengthAdjust="spacingAndGlyphs" fill="${fill}"${s.bold ? ' font-weight="700"' : ''}>${esc(m[0])}</text>`)
        col += run.length
      }
    }
  })
  return out
}

// One cell of a glyph: blocks and quadrants as rects, the shades as dot patterns of 75%, 50% and 25%.
const defs = new Map()
function cell(g, px, top, fill) {
  const y = top + LH * 0.1, h = LH * 0.8, hw = CW / 2, hh = h / 2
  const r = (x, y, w, h, f = fill) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}"/>`
  if (g === '█') return r(px, y, CW, h)
  if (g === '▌') return r(px, y, hw, h)
  if (g === '▐') return r(px + hw, y, hw, h)
  if (g === '▚') return r(px, y, hw, hh) + r(px + hw, y + hh, hw, hh)
  if (g === '▞') return r(px + hw, y, hw, hh) + r(px, y + hh, hw, hh)
  const id = `shade${'▓▒░'.indexOf(g)}${fill.slice(1)}`
  const dots = { '▓': [[0, 0], [1, 0], [0, 1]], '▒': [[0, 0], [1, 1]], '░': [[0, 0]] }[g]
  defs.set(id, `<pattern id="${id}" width="3" height="3" patternUnits="userSpaceOnUse">${dots.map(([a, b]) => r(a * 1.5, b * 1.5, 1.5, 1.5)).join('')}</pattern>`)
  return r(px, y, CW, h, `url(#${id})`)
}

function svg(width, height, body) {
  const patterns = [...defs.values()].join('')
  defs.clear()
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs>${patterns}</defs>
<rect width="${width}" height="${height}" rx="10" fill="${BG}" stroke="${BORDER}"/>
<g font-family="${FONT}" font-size="13">
${body.join('\n')}
</g>
</svg>
`
}

const s2 = [['thinking', 9], ['reading', 14], ['thinking', 5], ['reading', 8], ['editing', 22], ['thinking', 6], ['shell', 31], ['thinking', 4], ['editing', 9], ['web', 12], ['thinking', 7], ['shell', 12]]
const s3 = [...s2, ['thinking', 8], ['agents', 48], ['thinking', 6], ['editing', 14], ['thinking', 11]]

// 1. The band: mid-turn (pulsing edge, spinner), then stopped (the same strip dimmed, done line).
{
  const W = 84
  const draw = (file, lines) =>
    writeFileSync(new URL(file, import.meta.url), svg(PAD * 2 + (W + 2) * CW, PAD * 2 + lines.length * LH - LH, column(lines, PAD, PAD)))
  draw('band.svg', [
    [dim('> fix the flaky login test')], [],
    [dim('⏺ Bash(npm test -- login)')], [dim('  ⎿ Running…')], [],
    [...strip(s2, W - 1, true), seg('█', { color: C.shell[1] })],
    [seg('⠹', { color: C.shell[1] }), bold(' Bash Run tests · 12s  '), ...legend(s2, 4)],
    { prompt: W + 2 }, [],
  ])
  draw('band-done.svg', [
    [dim('⏺ Fixed: the test now awaits the session refresh before asserting. All')], [dim('  42 login tests pass.')], [],
    strip(s2, W, true, true),
    [dim('✓ Done in 2m40s · waiting on you  '), ...legend(s2, 3)],
    { prompt: W + 2 }, [],
  ])
}

// 2. The panel docked beside the conversation, band underneath.
{
  const PW = 56, barW = PW - 25, LW = 56
  const pane = [
    [bold('Session 42m10s'), dim('  agent 18m32s · 6 turns')],
    [seg('▶ Edit hooks/register.tsx · 3s')], [],
  ]
  const tot = totalsOf(s3), sum = tot.reduce((a, [, s]) => a + s, 0)
  for (const [c, s] of tot) {
    const k = Math.round((s / sum) * barW)
    pane.push([seg(C[c][0].padEnd(11)), seg(C[c][2].repeat(k), { color: C[c][1] }), dim('·'.repeat(barW - k)), seg(` ${fmt(s).padStart(6)} ${String(Math.round((s / sum) * 100)).padStart(3)}%`)])
  }
  pane.push([dim('Waiting on you'.padEnd(11 + barW) + ' ' + '23m38s'.padStart(6))], [], [bold('Timeline')])
  const turns = [
    { at: '41m02s', dur: '1m08s', seq: [['thinking', 20], ['reading', 12], ['editing', 9]], line: dim('Working: add a dark mode toggle to settings') },
    { at: '35m40s', dur: '1m31s', seq: [['thinking', 10], ['agents', 48], ['thinking', 6], ['editing', 14]], line: dim('Summarizing…') },
    { divider: '── Auto-compacted · +30m12s ' },
    { at: '22m15s', dur: '2m40s', seq: s2, line: seg('Fixed the flaky login test by awaiting the session'), more: seg('refresh, then ran the suite green.') },
    { at: '18m02s', dur: '42s', seq: [['thinking', 8], ['reading', 14], ['shell', 20]], interrupted: true, line: seg('Started profiling the build before being interrupted.') },
    { at: '3m11s', dur: '4m05s', seq: [['thinking', 30], ['reading', 70], ['thinking', 25], ['editing', 60], ['shell', 60]], line: seg('Read the auth module and added retry with backoff to'), more: seg('the token refresh.') },
  ]
  for (const t of turns) {
    if (t.divider) {
      pane.push([dim(t.divider.padEnd(PW, '─'))], [])
      continue
    }
    pane.push([dim(`+${t.at.padEnd(7)} ${t.dur.padStart(6)}  `), ...strip(t.seq, 24), ...(t.interrupted ? [seg(' interrupted', { color: WARN })] : [])])
    pane.push([t.line])
    if (t.more) pane.push([t.more])
    pane.push([])
  }
  const left = [
    [dim('> add a dark mode toggle to settings')], [],
    [dim("⏺ I'll find where settings are rendered.")], [],
    [dim('⏺ Read(src/settings/Panel.tsx)')], [dim('  ⎿ Read 142 lines')], [],
    [dim('⏺ Update(src/settings/Panel.tsx)')], [dim('  ⎿ …')],
  ]
  while (left.length < pane.length - 5) left.push([])
  left.push([...strip(s3, LW - 1, true), seg('█', { color: C.editing[1] })], [seg('⠹', { color: C.editing[1] }), bold(' Edit hooks/register.tsx · 3s  '), ...legend(s3, 1)], { prompt: LW })
  const rows = Math.max(left.length + 1, pane.length)
  const xR = PAD + (LW + 3) * CW
  const width = xR + PW * CW + PAD
  const body = [...column(left, PAD, PAD), `<line x1="${xR - CW * 1.5}" y1="${PAD}" x2="${xR - CW * 1.5}" y2="${PAD + rows * LH}" stroke="${BORDER}"/>`, ...column(pane, xR, PAD)]
  writeFileSync(new URL('panel.svg', import.meta.url), svg(width, PAD * 2 + rows * LH, body))
}

// 3. How the strip squeezes out time spent waiting on you.
{
  const W = 760, H = 150, x0 = PAD, bw = W - PAD * 2
  const wall = [['thinking', 6], ['idle', 70], ['thinking', 9], ['reading', 22], ['editing', 22], ['shell', 31], ['idle', 140], ['thinking', 8], ['agents', 48], ['editing', 14], ['idle', 40]]
  const bar = (seq, y) => {
    const total = seq.reduce((n, [, s]) => n + s, 0)
    let x = x0
    return seq.map(([c, s]) => {
      const w = (s / total) * bw
      const r = c === 'idle'
        ? `<rect x="${x}" y="${y}" width="${w}" height="20" fill="url(#idle)"/>`
        : `<rect x="${x}" y="${y}" width="${w}" height="20" fill="${C[c][1]}"/>`
      x += w
      return r
    })
  }
  const body = [
    `<defs><pattern id="idle" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="${BG}"/><rect width="2" height="6" fill="${DIM}"/></pattern></defs>`,
    `<text x="${x0}" y="${PAD + 12}" fill="${DIM}">Wall clock (striped = waiting on you)</text>`,
    ...bar(wall, PAD + 20),
    `<text x="${x0}" y="${PAD + 74}" fill="${DIM}">Band strip: working time only</text>`,
    ...bar(wall.filter(([c]) => c !== 'idle'), PAD + 82),
  ]
  writeFileSync(new URL('strip.svg', import.meta.url), svg(W, H, body))
}
