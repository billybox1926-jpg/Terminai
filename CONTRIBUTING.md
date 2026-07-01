# Contributing

Thank you for wanting to improve TerminAI. This is a focused, single-app
workspace project. Please keep changes aligned with the product rule:
**One app. One dashboard. One runtime.**

## Quick path

1. Open or find an issue and confirm the direction.
2. Create a focused feature branch from `main`.
3. Make the smallest change that satisfies the requirement.
4. Run `npm run check`.
5. Open a pull request with a short description and affected area.

## Local checks

```bash
npm ci
npm run check
```

`npm run check` runs type-checking, runtime manifest validation, tests,
production build, runtime status, and command/file API safety smoke tests.

## Branch conventions

- Use `main` as the integration branch.
- Use feature branches with a short prefixed name.
- Keep PRs small and reviewable.

## License

By contributing, you agree that your contributions will be licensed under
the project's MIT License.
