# Diff Changelog

Comparing:
- Source: https://github.com/bitfocus/companion-module-audinate-dante-ddm
- Target: https://github.com/studdmufin/companion-module-audinate-dante-ddm

Date: 2025-08-21

## Added (present in Source; absent or reduced in Target)
- Large domain support
  - Config threshold `maxChannelsForDropdowns` to switch to text-input UI for big domains.
  - Minimal/text-input actions and feedbacks to avoid UI hangs on large RX counts.
- Polling and fetch controls
  - Configurable `pollInterval`, `fullFetchInterval`.
  - Alternating lightweight subscription-only polling via `getDomainSubscriptions`.
  - Force Full Fetch action and serialized full-fetch helper (queueing when a poll is running).
  - Pause/resume polling helpers; optional `pausePollingOnBulkApply` during bulk apply.
- Bulk multi-channel apply
  - Text/simple-input multi-channel actions with “learn” helpers.
  - Robust batching + verification + retry via `setMultipleChannelDeviceSubscriptionsWithRetry` with tunables:
    - `bulkBatchSize`, `bulkRetries`, `bulkBatchDelayMs`, `bulkRetryDelayMs`.
- UI stability
  - Hash-based `_maybeUpdateActions`/`_maybeUpdateFeedbacks` to avoid needless UI rebuilds.
- New files/docs
  - `src/dante-api/getDomainSubscriptions.ts`, `src/dante-api/getDomainOptimized.ts`.
  - `LARGE_DOMAIN.md`, `TROUBLESHOOTING.md`.

## Changed
- Polling (src/main.ts)
  - Source: adaptive interval, alternates between full domain fetch and subscription-only fetch; overlap guard; immediate first poll; detailed logging; conditional UI updates for large domains; queued force full fetch.
  - Target: fixed 2s polling; always uses `getDomain`; simpler init, fewer guards/logs.
- Actions (src/actions.ts)
  - Source adds: Force Full Fetch, multi-channel bulk actions (with learn), device channel listing helper, large-domain text-input actions.
  - Target trims to dropdown-based actions; removes the above.
- Feedbacks (src/feedbacks.ts)
  - Source computes RX count and switches to minimal feedbacks; includes simple multi-channel status feedback.
  - Target removes minimal/large-domain feedbacks and the simple multi-channel status.
- Subscriptions API (src/dante-api/setDeviceSubscriptions.ts)
  - Source includes optimistic cache updates, refetches, and a verify/retry bulk path.
  - Target removes optimistic updates/refetchQueries and the retry/verify utilities.
- Config (src/config.ts)
  - Source defines extra fields: `pollInterval`, `fullFetchInterval`, `maxChannelsForDropdowns`, `pausePollingOnBulkApply`, `bulkBatchSize`, `bulkRetries`, `bulkBatchDelayMs`, `bulkRetryDelayMs`.
  - Target retains only core fields.

## Tooling/Packaging
- Version: Source `1.2.4+dev` vs Target `1.2.3`.
- Scripts
  - Target uses yarn for dev/build and `build:module` (with production install). 
  - Source uses npm and `pack:module`.
- Dependencies
  - Target pins slightly older versions (e.g., `@apollo/client` ^3.10.4 vs ^3.11.8; `graphql` ^16.8.1 vs ^16.9.0; `typescript` ^5.4.5 vs ^5.9.2).
- Codegen outputs and `dante-api.graphql` differ accordingly.
- ESLint/tsconfig and pipeline files differ.

## Removed in Target (relative to Source)
- `getDomainSubscriptions.ts`, `getDomainOptimized.ts`.
- Force full fetch and queueing logic.
- Large-domain text-input actions/feedbacks.
- Bulk-apply verification/retry and related tunables.
- Optimistic cache updates and refetchQueries.

## Potential breaking differences (moving to Target)
- Advanced config fields (polling/bulk/large-domain tunables) are absent.
- No force full fetch action; fixed polling cadence.
- Bulk operations won’t verify/retry or pause polling.
- Minimal/large-domain UI paths removed.
