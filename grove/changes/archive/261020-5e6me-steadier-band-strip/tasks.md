## T-01 — Step-zoom strip with whole-block columns

Result: the band's strip follows the scale and column requirements in [specs/band/spec.md](specs/band/spec.md), and the panel's per-turn bars use whole-block columns.

Acceptance:
- Unit tests in `tests/recap.test.ts` cover each scenario in the band spec: a second added with room left, the bar filling up, a long session on a fresh band, the split column, and two redraws with no change.
- A render test in `tests/render.test.tsx` mounts the band twice across an added second, on terminal and desktop, and finds the earlier blocks unchanged.
- `claude plugin validate .`, `claude plugin test .` and `npx -p typescript tsc -p .` pass.

## T-02 — README and images for the new strip

Result: the README's account of the strip matches the new drawing, and its images are redrawn.

Acceptance:
- `README.md` no longer says each cell takes the majority color. It says the strip fills from the left at a fixed scale that doubles when the bar is full, and that the whole session is always shown.
- `docs/mockups.mjs` draws the strip the new way, it has been run, and the regenerated SVGs have been checked in a browser.
