# npm Publishing

The `package.json` name for this project is `terminai`. This note covers the
delta between “README shop-ready” and “npm publish-ready.”

## Current scope

The repo is a local Node/Vite app with an Express backend. It is not packaged
for public npm distribution yet. The web prototype is useful for development,
but shipping it to npm requires a few explicit choices:
- whether `npm` users install a CLI wrapper or a library
- whether the bundle includes the web client or server only
- whether Android artifacts are published separately or bundled

## Recommended shape

Publish two artifacts:
- `terminai` — local runtime launcher and CLI wrapper for the existing app
- `@terminai/android` — Android-specific `runtime-bundle` tooling, if that
  layer is extracted later

For now, keep publishing under the repo root `package.json` and prepare the
`terminai` package for release when the release workflow is ready.

## Checklist before tagging a public release

1. Update `package.json` and export/bin fields when a CLI wrapper is added.
2. Run `npm run check` and confirm all gates pass.
3. Build the web/client and server bundle with `npm run build`.
4. Run `npm pack` locally and inspect the tarball contents.
5. Publish with `npm publish --access public` from a clean checkout.

## Keeping README and package aligned

The README and `package.json` should agree on:
- package name
- current version
- supported Node/npm versions
- install commands

Update these as one batch in release prep, not piecemeal in feature PRs.
