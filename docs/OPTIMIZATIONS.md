# AutomateStash Optimization Plan

This document lists practical, low‑risk improvements to optimize AutomateStash-Final.js. Each item includes expected impact and implementation notes.

## 1) One-call GraphQL: coalesce + TTL cache + timeout (Implement first) ✅
- Coalesce concurrent scene queries, add a short TTL cache (e.g., 5s), and enforce HTTP timeouts with AbortController.
- Update validators to derive from a single sceneDetails fetch.
- Impact: 2–3x fewer requests per status cycle, faster UI, lower server load.

Implementation notes:
- Expose `GraphQLClient.clear()` to reset caches after save/organize events.
- Ensure `SourceDetector` and status trackers reuse the same `GraphQLClient` instance.

## 2) Narrow the MutationObserver scope (partial) ⚙️
- Observe only the scene/edit container instead of document.body and prefer selector checks over text scans.
- Keep debounce; use adaptive delay (250–1000ms).
- Impact: Fewer callbacks, reduced main-thread work.

Implementation notes:
- Use `findObserverRoot()` and prefer `.entity-edit-panel`/`.scene-edit-details`.
- Debounce adaptively (starts ~800ms; increases under churn, decays to 400ms as DOM stabilizes).

## 3) Replace fixed sleeps with evented waits (partial) ⚙️
- Introduce waitForElement([selectors], {timeout}). Use it in scraping flows instead of arbitrary setTimeout waits.
- Impact: Faster success on fast UIs; fewer flaky waits on slow UIs.

Implementation notes:
- Removed unconditional wait in `checkAlreadyScraped()`.
- Added fetch instrumentation and GraphQL mutation event in `saveScene()`, `applyScrapedData()`, and `updateStatusAfterOrganize()`; reduced waits.
- Bounded small waits (e.g., 200–300ms) remain only where UI needs short render time.

## 4) Reduce broad DOM scans (partial) ⚙️
- Replace querySelectorAll('*') patterns with targeted selectors.
- Cache commonly used elements (e.g., scrape button) and validate before reuse.
- Impact: Lower layout/paint cost and faster updates.

Implementation notes:
- Scoped `save` and `apply` button searches to the edit container root rather than `document`.
- Avoided broad queries in hot paths; prefer targeted selectors.
- Cached `editRoot` derived from observer root for reuse across queries.

## 5) Share sceneDetails across detectors (partial) ⚙️
- Fetch once and derive stashdb/theporndb/organized in one pass.
- Fall back to DOM only when GraphQL unavailable.
- Impact: Minimal network and faster status aggregation.
Implementation notes:
- `StatusTracker.detectCurrentStatus()` now fetches once and passes `sceneDetails` to `SourceDetector` methods.
- `checkAlreadyScraped()` reuses a single `sceneDetails` when available.

## 6) Guard image resolution checks ✅
- Gate by config and add timeouts; only update if improvement ≥ 20%.
- Skip when cancelled; handle CORS errors gracefully.
- Impact: Fewer image downloads, faster completion.
Implementation notes:
- `compareThumbnails()` enforces a 20% minimum improvement and respects `PREFER_HIGHER_RES_THUMBNAILS`.

## 7) Listener/observer lifecycle hygiene (partial) ⚙️
Implementation notes:
- Added `removeOverlayListeners()` and invoked in `cleanup()`; ensured cancel/skip overlays are hidden on cleanup.
- `initializeMutationObserver()` disconnects and re-initializes cleanly; observer root is scoped.
- Remove global listeners on minimize/hide/destroy and reconnect on expand.
- Impact: Stable memory/CPU over long sessions.

Additional micro-optimizations ✅
- Central helper `waitForGraphQLMutation()` to avoid repeating event/timeout race logic.
- Reuse overlays (cancel/skip) by toggling display instead of destroying/creating each time.
- Passive event listeners on drag interactions where safe to reduce main-thread blocking.

## 8) Debug mode + dedup notifications (partial) ⚙️
- `CONFIG.DEBUG` exists and `debugLog()` is used for conditional diagnostics; added fallback logs on GraphQL detection errors.
- `NotificationManager` already dedupes within 5s.
- Structured timing logs and broader instrumentation: TBD.

## 9) Small correctness/perf fixes (partial) ⚙️
- Use CONFIG constant in getConfig calls (e.g., PREFER_HIGHER_RES_THUMBNAILS).
- Added 300ms debounce for summary widget re-render to reduce layout thrash.
- Reduced magic waits (short bounded waits) in organize/apply/save/create flows; added cancellation checks.
- Early-return cancellation in `collectScrapedData()` and slight wait reduction.
- Optionally cap history payload sizes and shallow-compare summary objects: TBD.

---

Implementation order
1) GraphQL coalescing + TTL + timeout (this commit)
2) MutationObserver scope + adaptive debounce
3) Evented waits for scraping
4) DOM scan reductions
5) Shared sceneDetails derivation
6) Thumbnail checks gating
7) Listener lifecycle cleanup
8) Debug mode + notification dedupe
9) Small fixes + polish
