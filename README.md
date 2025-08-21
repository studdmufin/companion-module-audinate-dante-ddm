# companion-module-audinate-dante-ddm

This module enables the ability to set Dante subscriptions using a managed Dante domain. It uses the GraphQL API provided by Dante Domain Manager.

> Important: Experimental build — not proven for production. Use at your own risk.

This variant includes advanced features for large domains and bulk operations. See below for highlights and the diff against upstream.

## User Documentation

See [HELP.md](./companion/HELP.md) for user documentation which is also what is displayed to the user when they click on the help icon in the UI.

For large-domain behavior, actions, feedbacks, and performance notes, see [LARGE_DOMAIN.md](./LARGE_DOMAIN.md).

## Requirements

- Node.js: ^22.8 or ^24.5 (see `package.json` engines)

## What’s different in this build

- Large-domain mode with text-input actions/feedbacks to keep the UI responsive
- Configurable polling and periodic full-fetch cadence; “Force Full Fetch” action
- Optional pause/resume polling during bulk apply
- Bulk multi-channel subscription actions, with batching and retry/verification
- Optimistic UI updates and fewer unnecessary UI rebuilds

For a concise comparison with the upstream module, see [DIFF_CHANGELOG.md](./DIFF_CHANGELOG.md).

### GraphQL CodeGen

GraphQL CodeGen generates TypeScript types based on the GraphQL schema and operations (mutations, queries, etc.)

Run `npm run graphql-codegen` on first setup and whenever the schema changes.

## Development

During development, you'll need to inform Companion where to look for dev modules (like this one).

Alternatively, if you are running Companion itself directly from its source code, create a symbolic link in `companion/module-local-dev` to this directory.

In general, follow the guide here
<https://github.com/bitfocus/companion-module-base/wiki>.

To run the project, run `npm run dev`.

To build a .tgz for use in Companion, run `npm run pack:module`. A file like `companion-module-audinate-dante-ddm-*.tgz` will appear in the project root. Ensure the manifest/module version is updated for dev builds.

Run `npm run test` to execute tests. Please make sure you have OpenSSL or LibreSSL installed before running tests.

## Maintainers

- James Abbottsmith <james.abbottsmith@gmail.com>

## License

See [LICENSE](./LICENSE)
