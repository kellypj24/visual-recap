# Contributing

Thanks for helping with visual-recap. Bug reports, ideas and pull requests are all welcome.

## Reporting a problem

Open an issue with:

- Your Claude Code version (`claude --version`) and terminal.
- What you expected to see in the band or panel, and what you saw. A screenshot helps.
- Any `visual-recap:` lines from the debug log (start Claude Code with `claude --debug`). Those lines say why a hook was skipped or a drawing was refused.

## Setting up

You need Claude Code. The mod uses Claude Code's plugin API for function hooks, which is early access and can change between releases.

```
git clone https://github.com/mascah/visual-recap
cd visual-recap
claude --plugin-dir .
```

That session loads the mod from your checkout and reloads it when you save a file. It also writes the API's type declarations to `.claude-plugin/types/` (ignored by git), which your editor and `tsc` use.

## Checks

Run these before opening a pull request. CI runs the first two on every PR.

```
claude plugin validate .   # reads the manifest and hooks the way Claude Code will
claude plugin test .       # the tests in tests/
npx -p typescript tsc -p . # type-check (after one `claude --plugin-dir .` session)
```

If you change how the band or panel looks, redraw the README images and check them in a browser:

```
node docs/mockups.mjs
```

## Pull requests

- Work on a branch. `main` only takes pull requests, merged by squash, and the `plugin` check must pass.
- Write the PR title as a [Conventional Commit](https://www.conventionalcommits.org/): `feat: …` for something users will notice, `fix: …` for a bug, `docs:`, `test:`, `ci:` or `chore:` for the rest. The squashed commit takes the PR title, and releases are built from it.
- Add or update a test for any change in behavior.
- If you change what the turn descriptions send to the model, update the README section about it.

## Releases

On each push to `main`, [release-please](https://github.com/googleapis/release-please) keeps a release PR open. Merging it bumps the version in `.claude-plugin/plugin.json`, tags the release and updates `CHANGELOG.md`. Claude Code offers an update to installed copies when that version changes.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
